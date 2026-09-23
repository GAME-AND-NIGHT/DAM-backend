import { NextRequest, NextResponse } from 'next/server';
import { getModelById } from '../../../../lib/catalog';
import { getResourceIV } from '../../../../lib/encryption';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
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
        stream_encrypted: true,
      },
      endpoints: {
        model_file_stream: `/model/file/${model.id}`,
        model_file_stream_full_url: `${baseUrl}/model/file/${model.id}`,
        model_file_raw: `/model/file/${model.id}?raw=true`,
        info: `/model/info/${model.id}`,
        chunks_example: `/model/file/${model.id}?chunk=0&chunkSize=262144`,
      },
    };

    return NextResponse.json(responseData, {
      headers: {
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (error: any) {
    console.error('Error fetching model info:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
