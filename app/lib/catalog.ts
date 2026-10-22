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

export interface VideoItem {
  id: number;
  file_name: string;
  title: string;
  category: string;
  description: string;
  size_bytes: number;
  size_mb: number;
  format: string;
  video_api_endpoint?: string;
  info_api_endpoint?: string;
  file_exists?: boolean;
}

function findDataDir(): string {
  if (process.env.DATA_DIR && fs.existsSync(process.env.DATA_DIR)) {
    return process.env.DATA_DIR;
  }

  const candidates = [
    path.join(process.cwd(), 'data'),
    path.resolve(__dirname, '../../data'),
    path.resolve(__dirname, '../../../data'),
    path.resolve(__dirname, '../../../../data'),
    path.resolve(__dirname, '../data'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  // Fallback upwards search from cwd
  let cur = process.cwd();
  for (let i = 0; i < 5; i++) {
    const candidate = path.join(cur, 'data');
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(cur);
    if (parent === cur) break;
    cur = parent;
  }

  return path.join(process.cwd(), 'data');
}

export function getDataDir(): string {
  return findDataDir();
}

export function getPaintingsDir(): string {
  return path.join(getDataDir(), 'russian_museum_paintings');
}

export function getModelsDir(): string {
  return path.join(getDataDir(), 'russia_models');
}

export function getVideosDir(): string {
  return path.join(getDataDir(), 'videos');
}

export function getAudioDir(): string {
  return path.join(getDataDir(), 'audio');
}

export function getAvatarDir(): string {
  const dataAvatar = path.join(getDataDir(), 'avatar');
  if (fs.existsSync(dataAvatar)) return dataAvatar;
  const publicAvatar = path.join(process.cwd(), 'public', 'models', 'avatar');
  if (fs.existsSync(publicAvatar)) return publicAvatar;
  return dataAvatar;
}

export function getAvatarFile(relPath: string = 'avatar.glb'): { filePath: string | null; fileName: string; sizeBytes: number; exists: boolean } {
  const avatarDir = getAvatarDir();
  const filePath = path.join(avatarDir, relPath);
  if (fs.existsSync(filePath)) {
    const stat = fs.statSync(filePath);
    return {
      filePath,
      fileName: path.basename(filePath),
      sizeBytes: stat.size,
      exists: true,
    };
  }
  return {
    filePath: null,
    fileName: relPath,
    sizeBytes: 0,
    exists: false,
  };
}

export function getQuestDataPath(): string {
  return path.join(getDataDir(), 'quest_data.json');
}

let cachedPaintings: PaintingItem[] | null = null;
let cachedModels: ModelItem[] | null = null;
let cachedVideos: VideoItem[] | null = null;

export function getPaintingsCatalog(): PaintingItem[] {
  if (cachedPaintings && cachedPaintings.length > 0) return cachedPaintings;

  try {
    const paintingsDir = getPaintingsDir();
    const catalogFile = path.join(paintingsDir, 'catalog.json');
    if (fs.existsSync(catalogFile)) {
      const data = JSON.parse(fs.readFileSync(catalogFile, 'utf8'));
      const rawPaintings: PaintingItem[] = data.paintings || [];

      cachedPaintings = rawPaintings.map((p) => {
        const fullFolder = path.join(paintingsDir, p.folder_name);
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
  if (cachedModels && cachedModels.length > 0) return cachedModels;

  try {
    const modelsDir = getModelsDir();
    const catalogFile = path.join(modelsDir, 'models_catalog.json');
    if (fs.existsSync(catalogFile)) {
      const data = JSON.parse(fs.readFileSync(catalogFile, 'utf8'));
      const rawModels: any[] = data.models || [];

      cachedModels = rawModels.map((m, index) => {
        const id = index + 1;
        const fullFolder = path.join(modelsDir, m.folder_name);
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

export function getVideosCatalog(): VideoItem[] {
  if (cachedVideos && cachedVideos.length > 0) return cachedVideos;

  try {
    const videosDir = getVideosDir();
    const catalogFile = path.join(videosDir, 'videos_catalog.json');
    if (fs.existsSync(catalogFile)) {
      const data = JSON.parse(fs.readFileSync(catalogFile, 'utf8'));
      const rawVideos: any[] = data.videos || [];

      cachedVideos = rawVideos.map((v) => {
        const fullPath = path.join(videosDir, v.file_name);
        let exists = fs.existsSync(fullPath);
        if (!exists && fs.existsSync(videosDir)) {
          const files = fs.readdirSync(videosDir);
          exists = files.some(
            (f) =>
              f.normalize('NFC').toLowerCase() === v.file_name.normalize('NFC').toLowerCase() ||
              f.normalize('NFD').toLowerCase() === v.file_name.normalize('NFD').toLowerCase()
          );
        }
        return {
          ...v,
          video_api_endpoint: `/video/file/${v.id}`,
          info_api_endpoint: `/video/info/${v.id}`,
          file_exists: exists,
        };
      });
      return cachedVideos;
    }
  } catch (err) {
    console.error('Error loading videos catalog:', err);
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

  const rawStr = String(idOrFolder);
  let decodedStr = rawStr;
  try {
    decodedStr = decodeURIComponent(rawStr).trim();
  } catch {}

  const numericId = Number(decodedStr);
  if (!isNaN(numericId) && numericId > 0) {
    found = paintings.find((p) => p.id === numericId);
  }

  if (!found) {
    const searchStr = decodedStr.toLowerCase();
    found = paintings.find(
      (p) =>
        p.folder_name.toLowerCase() === searchStr ||
        p.folder_name.toLowerCase().includes(searchStr)
    );
  }

  if (!found) {
    return { painting: null, imagePath: null, infoData: null };
  }

  const paintingsDir = getPaintingsDir();
  const folderPath = path.join(paintingsDir, found.folder_name);
  let imagePath = path.join(folderPath, found.local_image || 'painting.jpg');
  const infoPath = path.join(folderPath, 'info.json');

  if (!fs.existsSync(imagePath) && fs.existsSync(folderPath)) {
    const files = fs.readdirSync(folderPath);
    const candidate = files.find((f) => /\.(jpg|jpeg|png|webp)$/i.test(f));
    if (candidate) {
      imagePath = path.join(folderPath, candidate);
    }
  }

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

  const rawStr = String(idOrFolder);
  let decodedStr = rawStr;
  try {
    decodedStr = decodeURIComponent(rawStr).trim();
  } catch {}

  const numericId = Number(decodedStr);
  if (!isNaN(numericId) && numericId > 0) {
    found = models.find((m) => m.id === numericId);
  }

  if (!found) {
    const searchStr = decodedStr.toLowerCase();
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

  const modelsDir = getModelsDir();
  const folderPath = path.join(modelsDir, found.folder_name);
  let glbPath = path.join(folderPath, found.glb_file);
  const infoPath = path.join(folderPath, 'info.json');

  if (!fs.existsSync(glbPath) && fs.existsSync(folderPath)) {
    const files = fs.readdirSync(folderPath);
    const candidate = files.find((f) => f.endsWith('.glb') || f.endsWith('.gltf'));
    if (candidate) {
      glbPath = path.join(folderPath, candidate);
    }
  }

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

export function getVideoById(idOrName: string | number): {
  video: VideoItem | null;
  videoPath: string | null;
  infoData: any | null;
} {
  const videos = getVideosCatalog();
  let found: VideoItem | undefined;

  const rawStr = String(idOrName);
  let decodedStr = rawStr;
  try {
    decodedStr = decodeURIComponent(rawStr).trim();
  } catch {}

  const numericId = Number(decodedStr);
  if (!isNaN(numericId) && numericId > 0) {
    found = videos.find((v) => v.id === numericId);
  }

  if (!found) {
    const searchStr = decodedStr.toLowerCase();
    found = videos.find(
      (v) =>
        v.file_name.toLowerCase() === searchStr ||
        v.title.toLowerCase() === searchStr ||
        v.file_name.toLowerCase().includes(searchStr) ||
        v.title.toLowerCase().includes(searchStr)
    );
  }

  if (!found) {
    return { video: null, videoPath: null, infoData: null };
  }

  const videosDir = getVideosDir();
  let videoPath = path.join(videosDir, found.file_name);

  if (!fs.existsSync(videoPath) && fs.existsSync(videosDir)) {
    const files = fs.readdirSync(videosDir);
    const normalizedTarget = found.file_name.normalize('NFC').toLowerCase();
    const matched = files.find(
      (f) =>
        f.normalize('NFC').toLowerCase() === normalizedTarget ||
        f.normalize('NFD').toLowerCase() === normalizedTarget ||
        f.toLowerCase() === found!.file_name.toLowerCase() ||
        f.includes(found!.file_name) ||
        found!.file_name.includes(f)
    );
    if (matched) {
      videoPath = path.join(videosDir, matched);
    }
  }

  return {
    video: found,
    videoPath: fs.existsSync(videoPath) ? videoPath : null,
    infoData: found,
  };
}

/**
 * Resolves an audio file from data/audio by its relative path (e.g. station2/q01_question.mp3)
 */
export function getAudioFile(relativePath: string): {
  audioPath: string | null;
  fileName: string;
  sizeBytes: number;
} {
  const audioDir = getAudioDir();
  // Sanitize path to prevent directory traversal
  const cleanRel = relativePath
    .replace(/^(\.\.[\/\\])+/, '')
    .replace(/^[\\\/]+/, '')
    .replace(/\\/g, '/');

  const targetPath = path.join(audioDir, cleanRel);

  if (fs.existsSync(targetPath) && fs.statSync(targetPath).isFile()) {
    const stat = fs.statSync(targetPath);
    return {
      audioPath: targetPath,
      fileName: path.basename(targetPath),
      sizeBytes: stat.size,
    };
  }

  return {
    audioPath: null,
    fileName: path.basename(cleanRel),
    sizeBytes: 0,
  };
}

/**
 * Reads and returns quest_data.json
 */
export function getQuestData(): any {
  const qPath = getQuestDataPath();
  if (fs.existsSync(qPath)) {
    try {
      return JSON.parse(fs.readFileSync(qPath, 'utf8'));
    } catch (e) {
      console.error('Error parsing quest_data.json:', e);
    }
  }
  return null;
}

/**
 * Lists all audio stations and files
 */
export function getAudioCatalog(): {
  total_files: number;
  stations: { [key: string]: number };
} {
  const audioDir = getAudioDir();
  const summary: { [key: string]: number } = {};
  let total = 0;

  if (fs.existsSync(audioDir)) {
    const entries = fs.readdirSync(audioDir, { withFileTypes: true });
    for (const ent of entries) {
      if (ent.isDirectory()) {
        const subDir = path.join(audioDir, ent.name);
        const files = fs.readdirSync(subDir).filter(f => f.endsWith('.mp3'));
        summary[ent.name] = files.length;
        total += files.length;
      }
    }
  }

  return {
    total_files: total,
    stations: summary,
  };
}

