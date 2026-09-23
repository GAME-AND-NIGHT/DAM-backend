import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import { getVideoById } from '../../../../lib/catalog';
import {
  createEncryptedFileStream,
  getResourceIV,
  nodeStreamToWebStream,
  DEFAULT_CHUNK_SIZE,
  encryptChunk,
} from '../../../../lib/encryption';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
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
    const chunkSize = Number(searchParams.get('chunkSize')) || (512 * 1024); // 512KB default for video
    const isRaw = searchParams.get('raw') === 'true' || searchParams.get('raw') === '1';
    const chunkParam = searchParams.get('chunk');

    const baseIV = getResourceIV(`video_${video.id}`);
    const ivHex = baseIV.toString('hex');
    const totalChunks = Math.ceil(totalSize / chunkSize);

    // Unencrypted raw fallback for standard video tags
    if (isRaw) {
      const fileBuffer = fs.readFileSync(videoPath);
      return new Response(fileBuffer, {
        headers: {
          'Content-Type': 'video/mp4',
          'Content-Length': totalSize.toString(),
          'Content-Disposition': `inline; filename="${encodeURIComponent(video.file_name)}"`,
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'public, max-age=86400',
        },
      });
    }

    // Segment / Chunk specific request
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
      const fileBuffer = fs.readFileSync(videoPath);
      const encryptedSegment = encryptChunk(fileBuffer, start, end, baseIV);

      return new Response(encryptedSegment, {
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Length': encryptedSegment.length.toString(),
          'X-Encrypted': 'true',
          'X-Encryption-Algorithm': 'aes-256-ctr',
          'X-Encryption-IV': ivHex,
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

    // Full Streaming Encrypted response in chunks
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
  } catch (error: any) {
    console.error('Error streaming video:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
