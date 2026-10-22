import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import { getModelsCatalog, getModelById } from '../../../lib/catalog';
import {
  createEncryptedFileStream,
  getResourceIV,
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
    const id = slug[1];

    // 1. GET /api/model/list
    if (action === 'list') {
      const { searchParams } = new URL(request.url);
      const q = (searchParams.get('q') || '').toLowerCase().trim();

      let allModels = getModelsCatalog();

      if (q) {
        allModels = allModels.filter(
          (m) =>
            m.title_ru.toLowerCase().includes(q) ||
            m.title_en.toLowerCase().includes(q) ||
            m.category.toLowerCase().includes(q) ||
            m.folder_name.toLowerCase().includes(q)
        );
      }

      return NextResponse.json({
        total: allModels.length,
        models: allModels,
      });
    }

    // 2. GET /api/model/info/[id]
    if (action === 'info' && id) {
      const { model, infoData } = getModelById(id);

      if (!model) {
        return NextResponse.json(
          { error: `Model not found for id: ${id}` },
          { status: 404 }
        );
      }

      const baseIV = getResourceIV(`model_${model.id}`);
      const host = request.headers.get('host') || 'localhost:3000';
      const proto = request.headers.get('x-forwarded-proto') || 'http';
      const baseUrl = `${proto}://${host}`;

      const responseData = {
        ...infoData,
        id: model.id,
        title_ru: model.title_ru,
        title_en: model.title_en,
        category: model.category,
        description_ru: model.description_ru,
        original_description: model.original_description,
        source_url: model.source_url,
        glb_file: model.glb_file,
        glb_size_mb: model.glb_size_mb,
        encryption: {
          algorithm: 'aes-256-ctr',
          key_hint: 'hhghghdgfjgfgdahgd',
          iv_hex: baseIV.toString('hex'),
          is_encrypted: true,
        },
        stream_endpoint: `${baseUrl}/api/model/file/${model.id}`,
        raw_endpoint: `${baseUrl}/api/model/file/${model.id}?raw=true`,
      };

      return NextResponse.json(responseData);
    }

    // 3. GET /api/model/file/[id]
    if (action === 'file' && id) {
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
      const chunkSize = Number(searchParams.get('chunkSize')) || 256 * 1024;
      const isRaw = searchParams.get('raw') === 'true' || searchParams.get('raw') === '1';
      const chunkParam = searchParams.get('chunk');

      const baseIV = getResourceIV(`model_${model.id}`);
      const ivHex = baseIV.toString('hex');
      const totalChunks = Math.ceil(totalSize / chunkSize);

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
    }

    return NextResponse.json(
      { error: `Invalid model route: /${slug.join('/')}` },
      { status: 404 }
    );
  } catch (error: any) {
    console.error('Error handling model route:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
