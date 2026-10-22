import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import crypto from 'crypto';
import { getVideosCatalog, getVideoById } from '../../../lib/catalog';
import {
  createEncryptedFileStream,
  getResourceIV,
  getOffsetIV,
  getDerivedKey,
  DEFAULT_KEY,
  nodeStreamToWebStream,
  encryptChunk,
} from '../../../lib/encryption';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string[] } }
) {
  try {
    const slug = params.slug || [];
    const action = slug[0]; // 'list' | 'info' | 'file'
    const rawId = slug[1];
    let id = rawId;
    if (rawId) {
      try {
        id = decodeURIComponent(rawId);
      } catch {}
    }

    // 1. GET /api/video/list
    if (action === 'list') {
      const { searchParams } = new URL(request.url);
      const q = (searchParams.get('q') || '').toLowerCase().trim();

      let allVideos = getVideosCatalog();

      if (q) {
        allVideos = allVideos.filter(
          (v) =>
            v.title.toLowerCase().includes(q) ||
            v.category.toLowerCase().includes(q) ||
            v.file_name.toLowerCase().includes(q) ||
            v.description.toLowerCase().includes(q)
        );
      }

      return NextResponse.json({
        total: allVideos.length,
        videos: allVideos,
      });
    }

    // 2. GET /api/video/info/[id]
    if (action === 'info' && id) {
      const { video, infoData } = getVideoById(id);

      if (!video) {
        return NextResponse.json(
          { error: `Video not found for id: ${id}` },
          { status: 404 }
        );
      }

      const baseIV = getResourceIV(`video_${video.id}`);
      const host = request.headers.get('host') || 'localhost:3000';
      const proto = request.headers.get('x-forwarded-proto') || 'http';
      const baseUrl = `${proto}://${host}`;

      const responseData = {
        ...infoData,
        id: video.id,
        file_name: video.file_name,
        title: video.title,
        category: video.category,
        description: video.description,
        size_mb: video.size_mb,
        format: video.format,
        encryption: {
          algorithm: 'aes-256-ctr',
          key_hint: 'hhghghdgfjgfgdahgd',
          iv_hex: baseIV.toString('hex'),
          stream_encrypted: true,
        },
        endpoints: {
          video_stream: `/video/file/${video.id}`,
          video_stream_full_url: `${baseUrl}/video/file/${video.id}`,
          video_raw: `/video/file/${video.id}?raw=true`,
          info: `/video/info/${video.id}`,
          chunks_example: `/video/file/${video.id}?chunk=0&chunkSize=524288`,
        },
      };

      return NextResponse.json(responseData, {
        headers: {
          'Cache-Control': 'public, max-age=86400',
        },
      });
    }

    // 3. GET /api/video/file/[id]
    if (action === 'file' && id) {
      const { searchParams } = new URL(request.url);
      const { video, videoPath } = getVideoById(id);

      if (!video || !videoPath) {
        return NextResponse.json(
          { error: `Video not found for id/name: ${id}` },
          { status: 404 }
        );
      }

      const stat = fs.statSync(videoPath);
      const totalSize = stat.size;
      const chunkSize = Number(searchParams.get('chunkSize')) || 512 * 1024;
      const isRaw = searchParams.get('raw') === 'true' || searchParams.get('raw') === '1';
      const chunkParam = searchParams.get('chunk');

      const baseIV = getResourceIV(`video_${video.id}`);
      const ivHex = baseIV.toString('hex');
      const totalChunks = Math.ceil(totalSize / chunkSize);

      if (isRaw) {
        const rangeHeader = request.headers.get('range');
        if (rangeHeader) {
          const parts = rangeHeader.replace(/bytes=/, '').split('-');
          const start = parseInt(parts[0], 10);
          const end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;
          const chunkLength = end - start + 1;

          const nodeStream = fs.createReadStream(videoPath, { start, end });
          const webStream = nodeStreamToWebStream(nodeStream);

          return new Response(webStream, {
            status: 206,
            headers: {
              'Content-Type': 'video/mp4',
              'Content-Range': `bytes ${start}-${end}/${totalSize}`,
              'Accept-Ranges': 'bytes',
              'Content-Length': chunkLength.toString(),
              'Content-Disposition': `inline; filename="${encodeURIComponent(video.file_name)}"`,
              'Cache-Control': 'public, max-age=86400',
            },
          });
        }

        const nodeStream = fs.createReadStream(videoPath);
        const webStream = nodeStreamToWebStream(nodeStream);
        return new Response(webStream, {
          headers: {
            'Content-Type': 'video/mp4',
            'Content-Length': totalSize.toString(),
            'Content-Disposition': `inline; filename="${encodeURIComponent(video.file_name)}"`,
            'Accept-Ranges': 'bytes',
            'Cache-Control': 'public, max-age=86400',
          },
        });
      }

      if (chunkParam !== null && !isNaN(Number(chunkParam))) {
        const chunkIndex = parseInt(chunkParam, 10);
        if (chunkIndex < 0 || chunkIndex >= totalChunks) {
          return NextResponse.json(
            { error: `Invalid chunk index ${chunkIndex}. Total chunks: ${totalChunks}` },
            { status: 400 }
          );
        }

        const start = chunkIndex * chunkSize;
        const end = Math.min(start + chunkSize, totalSize);
        const chunkLength = end - start;
        const readBuffer = Buffer.alloc(chunkLength);
        const fd = fs.openSync(videoPath, 'r');
        fs.readSync(fd, readBuffer, 0, chunkLength, start);
        fs.closeSync(fd);

        const blockOffset = Math.floor(start / 16);
        const chunkIV = getOffsetIV(baseIV, blockOffset);
        const key = getDerivedKey(DEFAULT_KEY);
        const cipher = crypto.createCipheriv('aes-256-ctr', key, chunkIV);
        const encryptedSegment = Buffer.concat([cipher.update(readBuffer), cipher.final()]);

        return new Response(encryptedSegment, {
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Expose-Headers': 'X-Encrypted, X-Encryption-Algorithm, X-Encryption-IV, X-Chunk-IV, X-Original-Content-Type, X-Chunk-Index, X-Total-Chunks, X-Chunk-Size, X-Total-Size, X-Item-Id',
            'Content-Type': 'application/octet-stream',
            'Content-Length': encryptedSegment.length.toString(),
            'X-Encrypted': 'true',
            'X-Encryption-Algorithm': 'aes-256-ctr',
            'X-Encryption-IV': ivHex,
            'X-Chunk-IV': chunkIV.toString('hex'),
            'X-Original-Content-Type': 'video/mp4',
            'X-Chunk-Index': chunkIndex.toString(),
            'X-Total-Chunks': totalChunks.toString(),
            'X-Chunk-Size': chunkSize.toString(),
            'X-Total-Size': totalSize.toString(),
            'X-Item-Id': video.id.toString(),
            'Cache-Control': 'public, max-age=86400',
          },
        });
      }

      const { stream } = createEncryptedFileStream(videoPath, baseIV, {
        chunkSize,
      });

      const webStream = nodeStreamToWebStream(stream);

      return new Response(webStream, {
        headers: {
          'Content-Type': 'application/octet-stream',
          'Transfer-Encoding': 'chunked',
          'X-Encrypted': 'true',
          'X-Encryption-Algorithm': 'aes-256-ctr',
          'X-Encryption-IV': ivHex,
          'X-Original-Content-Type': 'video/mp4',
          'X-Total-Size': totalSize.toString(),
          'X-Chunk-Size': chunkSize.toString(),
          'X-Total-Chunks': totalChunks.toString(),
          'X-Item-Id': video.id.toString(),
          'Cache-Control': 'public, max-age=86400',
        },
      });
    }

    return NextResponse.json(
      { error: `Invalid video route: /${slug.join('/')}` },
      { status: 404 }
    );
  } catch (error: any) {
    console.error('Error handling video route:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
