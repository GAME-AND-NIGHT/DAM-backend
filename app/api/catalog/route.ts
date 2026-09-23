import { NextRequest, NextResponse } from 'next/server';
import { getPaintingsCatalog, getModelsCatalog, getVideosCatalog } from '../../lib/catalog';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const paintings = getPaintingsCatalog();
    const models = getModelsCatalog();
    const videos = getVideosCatalog();

    return NextResponse.json({
      status: 'online',
      museum_collection: {
        name: 'Государственный Русский Музей (The State Russian Museum)',
        location: 'Санкт-Петербург, Россия',
        paintings_count: paintings.length,
        sample_endpoints: {
          info_sample: '/painting/info/2',
          image_sample_stream: '/painting/image/2',
          image_chunk_sample: '/painting/image/2?chunk=0&chunkSize=65536',
          paintings_list: '/painting/list?page=1&limit=20',
        },
      },
      models_collection: {
        name: 'Российские 3D-модели (Dinosaur, Fauna, Museum models)',
        models_count: models.length,
        sample_endpoints: {
          info_sample: '/model/info/1',
          file_sample_stream: '/model/file/1',
          file_chunk_sample: '/model/file/1?chunk=0&chunkSize=262144',
          models_list: '/model/list',
        },
      },
      videos_collection: {
        name: 'Видеоэкскурсии и фильмы об искусстве (MP4)',
        videos_count: videos.length,
        sample_endpoints: {
          info_sample: '/video/info/1',
          file_sample_stream: '/video/file/1',
          file_chunk_sample: '/video/file/1?chunk=0&chunkSize=524288',
          videos_list: '/video/list',
        },
      },
      encryption_spec: {
        cipher: 'AES-256-CTR',
        key_passphrase: 'hhghghdgfjgfgdahgd',
        key_derivation: 'SHA-256(passphrase)',
        iv_header: 'X-Encryption-IV',
        streaming: 'Transfer-Encoding: chunked',
        range_support: 'Segment index ?chunk=N or Range header',
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
