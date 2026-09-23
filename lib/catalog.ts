import path from 'path';
import fs from 'fs';

export interface PaintingItem {
  id: number;
  folder_name: string;
  title: string;
  artist: string;
  date: string;
  medium: string;
  dimensions: string;
  license: string;
  museum: string;
  aspect_ratio: number;
  original_width: number;
  original_height: number;
  image_url: string;
  original_source_url: string;
  commons_page: string;
  local_folder: string;
  local_image: string;
  local_image_rel_path: string;
  // Computed helpers
  image_api_endpoint?: string;
  info_api_endpoint?: string;
  file_exists?: boolean;
}

export interface ModelItem {
  id: number;
  folder_name: string;
  title_ru: string;
  title_en: string;
  category: string;
  description_ru: string;
  original_description: string;
  source_url: string;
  glb_file: string;
  glb_path: string;
  glb_size_mb: number;
  has_info_json: boolean;
  // Computed helpers
  file_api_endpoint?: string;
  info_api_endpoint?: string;
  file_exists?: boolean;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const PAINTINGS_DIR = path.join(DATA_DIR, 'russian_museum_paintings');
const MODELS_DIR = path.join(DATA_DIR, 'russia_models');

let cachedPaintings: PaintingItem[] | null = null;
let cachedModels: ModelItem[] | null = null;

export function getPaintingsCatalog(): PaintingItem[] {
  if (cachedPaintings) return cachedPaintings;

  try {
    const catalogFile = path.join(PAINTINGS_DIR, 'catalog.json');
    if (fs.existsSync(catalogFile)) {
      const data = JSON.parse(fs.readFileSync(catalogFile, 'utf8'));
      const rawPaintings: PaintingItem[] = data.paintings || [];

      cachedPaintings = rawPaintings.map((p) => {
        const fullFolder = path.join(PAINTINGS_DIR, p.folder_name);
        const imagePath = path.join(fullFolder, p.local_image || 'painting.jpg');
        return {
          ...p,
          image_api_endpoint: `/painting/image/${p.id}`,
          info_api_endpoint: `/painting/info/${p.id}`,
          file_exists: fs.existsSync(imagePath),
        };
      });
      return cachedPaintings;
    }
  } catch (err) {
    console.error('Error loading paintings catalog:', err);
  }

  return [];
}

export function getModelsCatalog(): ModelItem[] {
  if (cachedModels) return cachedModels;

  try {
    const catalogFile = path.join(MODELS_DIR, 'models_catalog.json');
    if (fs.existsSync(catalogFile)) {
      const data = JSON.parse(fs.readFileSync(catalogFile, 'utf8'));
      const rawModels: any[] = data.models || [];

      cachedModels = rawModels.map((m, index) => {
        const id = index + 1;
        const fullFolder = path.join(MODELS_DIR, m.folder_name);
        const glbPath = path.join(fullFolder, m.glb_file);

        return {
          id,
          folder_name: m.folder_name,
          title_ru: m.title_ru || m.folder_name,
          title_en: m.title_en || m.folder_name,
          category: m.category || '',
          description_ru: m.description_ru || '',
          original_description: m.original_description || '',
          source_url: m.source_url || '',
          glb_file: m.glb_file,
          glb_path: m.glb_path || `russia_models/${m.folder_name}/${m.glb_file}`,
          glb_size_mb: m.glb_size_mb || 0,
          has_info_json: m.has_info_json ?? fs.existsSync(path.join(fullFolder, 'info.json')),
          file_api_endpoint: `/model/file/${id}`,
          info_api_endpoint: `/model/info/${id}`,
          file_exists: fs.existsSync(glbPath),
        };
      });
      return cachedModels;
    }
  } catch (err) {
    console.error('Error loading models catalog:', err);
  }

  return [];
}

export function getPaintingById(idOrFolder: string | number): {
  painting: PaintingItem | null;
  imagePath: string | null;
  infoData: any | null;
} {
  const paintings = getPaintingsCatalog();
  let found: PaintingItem | undefined;

  const numericId = Number(idOrFolder);
  if (!isNaN(numericId)) {
    found = paintings.find((p) => p.id === numericId);
  }

  if (!found) {
    const searchStr = String(idOrFolder).toLowerCase();
    found = paintings.find(
      (p) =>
        p.folder_name.toLowerCase() === searchStr ||
        p.folder_name.toLowerCase().includes(searchStr)
    );
  }

  if (!found) {
    return { painting: null, imagePath: null, infoData: null };
  }

  const folderPath = path.join(PAINTINGS_DIR, found.folder_name);
  const imagePath = path.join(folderPath, found.local_image || 'painting.jpg');
  const infoPath = path.join(folderPath, 'info.json');

  let infoData = null;
  if (fs.existsSync(infoPath)) {
    try {
      infoData = JSON.parse(fs.readFileSync(infoPath, 'utf8'));
    } catch {
      infoData = found;
    }
  } else {
    infoData = found;
  }

  return {
    painting: found,
    imagePath: fs.existsSync(imagePath) ? imagePath : null,
    infoData,
  };
}

export function getModelById(idOrFolder: string | number): {
  model: ModelItem | null;
  glbPath: string | null;
  infoData: any | null;
} {
  const models = getModelsCatalog();
  let found: ModelItem | undefined;

  const numericId = Number(idOrFolder);
  if (!isNaN(numericId)) {
    found = models.find((m) => m.id === numericId);
  }

  if (!found) {
    const searchStr = String(idOrFolder).toLowerCase();
    found = models.find(
      (m) =>
        m.folder_name.toLowerCase() === searchStr ||
        m.title_en.toLowerCase() === searchStr ||
        m.title_ru.toLowerCase() === searchStr ||
        m.folder_name.toLowerCase().includes(searchStr)
    );
  }

  if (!found) {
    return { model: null, glbPath: null, infoData: null };
  }

  const folderPath = path.join(MODELS_DIR, found.folder_name);
  const glbPath = path.join(folderPath, found.glb_file);
  const infoPath = path.join(folderPath, 'info.json');

  let infoData: any = { ...found };
  if (fs.existsSync(infoPath)) {
    try {
      const extraInfo = JSON.parse(fs.readFileSync(infoPath, 'utf8'));
      infoData = { ...found, ...extraInfo };
    } catch {}
  }

  return {
    model: found,
    glbPath: fs.existsSync(glbPath) ? glbPath : null,
    infoData,
  };
}
