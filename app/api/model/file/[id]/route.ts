import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import { getModelById } from '../../../../lib/catalog';
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

    const { model, glbPath } = getModelById(id);

    if (!model || !glbPath) {
      return NextResponse.json(
        { error: `3D Model not found for id/name: ${id}` },
        { status: 404 }
      );
    }

    const stat = fs.statSync(glbPath);
    const totalSize = stat.size;
    const chunkSize = Number(searchParams.get('chunkSize')) || (256 * 1024); // 256KB default for 3D models
    const isRaw = searchParams.get('raw') === 'true' || searchParams.get('raw') === '1';
    const chunkParam = searchParams.get('chunk');

    const baseIV = getResourceIV(`model_${model.id}`);
    const ivHex = baseIV.toString('hex');
    const totalChunks = Math.ceil(totalSize / chunkSize);

    // Unencrypted raw fallback for preview/testing
    if (isRaw) {
      const fileBuffer = fs.readFileSync(glbPath);
      return new Response(fileBuffer, {
        headers: {
          'Content-Type': 'model/gltf-binary',
          'Content-Length': totalSize.toString(),
          'Content-Disposition': `inline; filename="${encodeURIComponent(model.glb_file)}"`,
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
      const fileBuffer = fs.readFileSync(glbPath);
      const encryptedSegment = encryptChunk(fileBuffer, start, end, baseIV);

      return new Response(encryptedSegment, {
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Length': encryptedSegment.length.toString(),
          'X-Encrypted': 'true',
          'X-Encryption-Algorithm': 'aes-256-ctr',
          'X-Encryption-IV': ivHex,
          'X-Original-Content-Type': 'model/gltf-binary',
          'X-Chunk-Index': chunkIndex.toString(),
          'X-Total-Chunks': totalChunks.toString(),
          'X-Chunk-Size': chunkSize.toString(),
          'X-Total-Size': totalSize.toString(),
          'X-Item-Id': model.id.toString(),
          'Cache-Control': 'public, max-age=86400',
        },
      });
    }

    // Full Streaming Encrypted response in chunks
    const { stream } = createEncryptedFileStream(glbPath, baseIV, {
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
        'X-Original-Content-Type': 'model/gltf-binary',
        'X-Total-Size': totalSize.toString(),
        'X-Chunk-Size': chunkSize.toString(),
        'X-Total-Chunks': totalChunks.toString(),
        'X-Item-Id': model.id.toString(),
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (error: any) {
    console.error('Error streaming 3D model:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
