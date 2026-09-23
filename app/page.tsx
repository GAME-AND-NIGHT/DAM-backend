'use client';

import React, { useState, useEffect } from 'react';
import {
  Shield,
  Layers,
  FileCode,
  Image as ImageIcon,
  Box,
  Key,
  Play,
  Copy,
  Check,
  ExternalLink,
  RefreshCw,
  Server,
  Zap,
  Film,
  Link as LinkIcon,
} from 'lucide-react';

export default function HomePage() {
  const [paintings, setPaintings] = useState<any[]>([]);
  const [models, setModels] = useState<any[]>([]);
  const [videos, setVideos] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'paintings' | 'models' | 'videos' | 'player' | 'api' | 'code'>('paintings');

  // Universal Player state
  const [customUrl, setCustomUrl] = useState<string>('/painting/image/2');
  const [customKey, setCustomKey] = useState<string>('hhghghdgfjgfgdahgd');
  const [playerLoading, setPlayerLoading] = useState<boolean>(false);
  const [playerProgress, setPlayerProgress] = useState<number>(0);
  const [playerStats, setPlayerStats] = useState<string>('');
  const [playerResultUrl, setPlayerResultUrl] = useState<string | null>(null);
  const [playerContentType, setPlayerContentType] = useState<string>('');
  const [playerIv, setPlayerIv] = useState<string>('');

  // Painting test state
  const [selectedPaintingId, setSelectedPaintingId] = useState<number>(2);
  const [paintingInfo, setPaintingInfo] = useState<any>(null);
  const [paintingLoading, setPaintingLoading] = useState<boolean>(false);
  const [paintingProgress, setPaintingProgress] = useState<number>(0);
  const [decryptedPaintingUrl, setDecryptedPaintingUrl] = useState<string | null>(null);
  const [paintingIv, setPaintingIv] = useState<string>('');
  const [paintingStats, setPaintingStats] = useState<string>('');

  // Model test state
  const [selectedModelId, setSelectedModelId] = useState<number>(1);
  const [modelInfo, setModelInfo] = useState<any>(null);
  const [modelLoading, setModelLoading] = useState<boolean>(false);
  const [modelProgress, setModelProgress] = useState<number>(0);
  const [decryptedModelUrl, setDecryptedModelUrl] = useState<string | null>(null);
  const [modelIv, setModelIv] = useState<string>('');
  const [modelStats, setModelStats] = useState<string>('');

  // Video test state
  const [selectedVideoId, setSelectedVideoId] = useState<number>(1);
  const [videoInfo, setVideoInfo] = useState<any>(null);
  const [videoLoading, setVideoLoading] = useState<boolean>(false);
  const [videoProgress, setVideoProgress] = useState<number>(0);
  const [decryptedVideoUrl, setDecryptedVideoUrl] = useState<string | null>(null);
  const [videoIv, setVideoIv] = useState<string>('');
  const [videoStats, setVideoStats] = useState<string>('');

  const [copiedKey, setCopiedKey] = useState(false);

  // Load catalogs
  useEffect(() => {
    fetch('/api/painting/list?limit=15')
      .then((res) => res.json())
      .then((data) => setPaintings(data.paintings || []))
      .catch((err) => console.error(err));

    fetch('/api/model/list')
      .then((res) => res.json())
      .then((data) => setModels(data.models || []))
      .catch((err) => console.error(err));

    fetch('/api/video/list')
      .then((res) => res.json())
      .then((data) => setVideos(data.videos || []))
      .catch((err) => console.error(err));
  }, []);

  // Fetch painting info
  useEffect(() => {
    if (!selectedPaintingId) return;
    fetch(`/painting/info/${selectedPaintingId}`)
      .then((res) => res.json())
      .then((data) => setPaintingInfo(data))
      .catch((err) => console.error(err));
  }, [selectedPaintingId]);

  // Fetch model info
  useEffect(() => {
    if (!selectedModelId) return;
    fetch(`/model/info/${selectedModelId}`)
      .then((res) => res.json())
      .then((data) => setModelInfo(data))
      .catch((err) => console.error(err));
  }, [selectedModelId]);

  // Fetch video info
  useEffect(() => {
    if (!selectedVideoId) return;
    fetch(`/video/info/${selectedVideoId}`)
      .then((res) => res.json())
      .then((data) => setVideoInfo(data))
      .catch((err) => console.error(err));
  }, [selectedVideoId]);

  // Universal Decrypt Helper
  const decryptMediaStream = async (url: string, passphrase: string, onProgress: (p: number, s: string) => void) => {
    const startTime = performance.now();
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP Error ${response.status}: ${response.statusText}`);

    const isEncrypted = response.headers.get('X-Encrypted') === 'true';
    const ivHex = response.headers.get('X-Encryption-IV') || '';
    let contentType = response.headers.get('X-Original-Content-Type') || response.headers.get('Content-Type') || '';
    const totalSize = parseInt(response.headers.get('X-Total-Size') || response.headers.get('Content-Length') || '0', 10);

    if (!contentType || contentType.includes('octet-stream')) {
      if (url.includes('/painting/') || url.endsWith('.jpg') || url.endsWith('.png')) contentType = 'image/jpeg';
      else if (url.includes('/model/') || url.endsWith('.glb')) contentType = 'model/gltf-binary';
      else if (url.includes('/video/') || url.endsWith('.mp4')) contentType = 'video/mp4';
      else contentType = 'image/jpeg';
    }

    const reader = response.body?.getReader();
    const chunks: Uint8Array[] = [];
    let receivedBytes = 0;

    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        receivedBytes += value.length;
        const percent = totalSize ? Math.min(100, Math.round((receivedBytes / totalSize) * 100)) : 100;
        onProgress(percent, `Получено: ${(receivedBytes / (1024 * 1024)).toFixed(2)} MB (${chunks.length} сегментов)`);
      }
    } else {
      const buf = await response.arrayBuffer();
      chunks.push(new Uint8Array(buf));
      receivedBytes = buf.byteLength;
      onProgress(100, `Получено: ${(receivedBytes / (1024 * 1024)).toFixed(2)} MB`);
    }

    const allBytes = new Uint8Array(receivedBytes);
    let pos = 0;
    for (const c of chunks) {
      allBytes.set(c, pos);
      pos += c.length;
    }

    let finalBuffer = allBytes.buffer;

    if (isEncrypted && ivHex) {
      onProgress(100, 'Расшифровка AES-256-CTR...');
      const keyData = new TextEncoder().encode(passphrase);
      const hash = await crypto.subtle.digest('SHA-256', keyData);
      const cryptoKey = await crypto.subtle.importKey('raw', hash, { name: 'AES-CTR' }, false, ['decrypt']);

      const ivMatches = ivHex.match(/.{1,2}/g) || [];
      const ivBytes = new Uint8Array(ivMatches.map((b) => parseInt(b, 16)));

      finalBuffer = await crypto.subtle.decrypt(
        { name: 'AES-CTR', counter: ivBytes, length: 128 },
        cryptoKey,
        allBytes
      );
    }

    const duration = ((performance.now() - startTime) / 1000).toFixed(2);
    const blob = new Blob([finalBuffer], { type: contentType });
    const objectUrl = URL.createObjectURL(blob);

    return {
      objectUrl,
      contentType,
      duration,
      sizeBytes: finalBuffer.byteLength,
      sizeMB: (finalBuffer.byteLength / (1024 * 1024)).toFixed(2),
      ivHex,
    };
  };

  // Handle Universal Custom URL
  const handleDecryptCustomUrl = async () => {
    setPlayerLoading(true);
    setPlayerProgress(0);
    setPlayerResultUrl(null);
    setPlayerStats('Подключение...');

    try {
      const result = await decryptMediaStream(customUrl, customKey, (p, s) => {
        setPlayerProgress(p);
        setPlayerStats(s);
      });

      setPlayerResultUrl(result.objectUrl);
      setPlayerContentType(result.contentType);
      setPlayerIv(result.ivHex);
      setPlayerStats(`✅ Расшифровано за ${result.duration}с (${result.sizeMB} MB, ${result.contentType})`);
    } catch (err: any) {
      setPlayerStats(`❌ Ошибка: ${err.message}`);
    } finally {
      setPlayerLoading(false);
    }
  };

  // Stream & Decrypt Painting
  const handleDecryptPainting = async () => {
    setPaintingLoading(true);
    setPaintingProgress(0);
    setDecryptedPaintingUrl(null);
    setPaintingStats('Загрузка потока...');

    try {
      const result = await decryptMediaStream(`/painting/image/${selectedPaintingId}`, 'hhghghdgfjgfgdahgd', (p, s) => {
        setPaintingProgress(p);
        setPaintingStats(s);
      });
      setDecryptedPaintingUrl(result.objectUrl);
      setPaintingIv(result.ivHex);
      setPaintingStats(`✅ Картина расшифрована за ${result.duration}с (${result.sizeMB} MB)`);
    } catch (err: any) {
      setPaintingStats(`❌ Ошибка: ${err.message}`);
    } finally {
      setPaintingLoading(false);
    }
  };

  // Stream & Decrypt Model
  const handleDecryptModel = async () => {
    setModelLoading(true);
    setModelProgress(0);
    setDecryptedModelUrl(null);
    setModelStats('Загрузка 3D-модели...');

    try {
      const result = await decryptMediaStream(`/model/file/${selectedModelId}`, 'hhghghdgfjgfgdahgd', (p, s) => {
        setModelProgress(p);
        setModelStats(s);
      });
      setDecryptedModelUrl(result.objectUrl);
      setModelIv(result.ivHex);
      setModelStats(`✅ 3D-модель расшифрована за ${result.duration}с (${result.sizeMB} MB)`);
    } catch (err: any) {
      setModelStats(`❌ Ошибка: ${err.message}`);
    } finally {
      setModelLoading(false);
    }
  };

  // Stream & Decrypt Video
  const handleDecryptVideo = async () => {
    setVideoLoading(true);
    setVideoProgress(0);
    setDecryptedVideoUrl(null);
    setVideoStats('Загрузка зашифрованного видеопотока...');

    try {
      const result = await decryptMediaStream(`/video/file/${selectedVideoId}`, 'hhghghdgfjgfgdahgd', (p, s) => {
        setVideoProgress(p);
        setVideoStats(s);
      });
      setDecryptedVideoUrl(result.objectUrl);
      setVideoIv(result.ivHex);
      setVideoStats(`✅ Видео расшифровано за ${result.duration}с (${result.sizeMB} MB)`);
    } catch (err: any) {
      setVideoStats(`❌ Ошибка: ${err.message}`);
    } finally {
      setVideoLoading(false);
    }
  };

  const copySecretKey = () => {
    navigator.clipboard.writeText('hhghghdgfjgfgdahgd');
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-50 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600/20 border border-indigo-500/40 rounded-xl text-indigo-400">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                DAM Encrypted Streaming Backend
                <span className="text-xs font-mono font-normal bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                  Next.js + Vercel
                </span>
              </h1>
              <p className="text-xs text-slate-400">
                AES-256-CTR Потоковое вещание сегментами: Картины (700) • 3D-Модели (34) • Видео (5)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-800/80 border border-slate-700/60 rounded-lg px-3 py-1.5 text-xs">
              <Key className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-slate-400">Ключ:</span>
              <code className="font-mono text-amber-300">hhghghdgfjgfgdahgd</code>
              <button
                onClick={copySecretKey}
                className="hover:text-white text-slate-400 transition ml-1"
                title="Скопировать ключ"
              >
                {copiedKey ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
            <a
              href="/player.html"
              target="_blank"
              className="flex items-center gap-1 bg-purple-600 hover:bg-purple-500 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition shadow-lg shadow-purple-600/20"
            >
              <span>player.html</span>
              <ExternalLink className="w-3 h-3" />
            </a>
            <a
              href="/api/catalog"
              target="_blank"
              className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition"
            >
              <Server className="w-3.5 h-3.5" />
              <span>/api/catalog</span>
            </a>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-2">
          <button
            onClick={() => setActiveTab('paintings')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
              activeTab === 'paintings'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <ImageIcon className="w-4 h-4" />
            Картины (700)
          </button>
          <button
            onClick={() => setActiveTab('models')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
              activeTab === 'models'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Box className="w-4 h-4" />
            3D-модели (34)
          </button>
          <button
            onClick={() => setActiveTab('videos')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
              activeTab === 'videos'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Film className="w-4 h-4" />
            Видео (5)
          </button>
          <button
            onClick={() => setActiveTab('player')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
              activeTab === 'player'
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-600/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <LinkIcon className="w-4 h-4 text-purple-400" />
            Универсальный Плеер по Ссылке
          </button>
          <button
            onClick={() => setActiveTab('api')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
              activeTab === 'api'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Layers className="w-4 h-4" />
            Спецификация API
          </button>
          <button
            onClick={() => setActiveTab('code')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
              activeTab === 'code'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <FileCode className="w-4 h-4" />
            Примеры дешифрования
          </button>
        </div>

        {/* Tab 1: Universal Player */}
        {activeTab === 'player' && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <LinkIcon className="w-5 h-5 text-purple-400" />
                Вставьте любую ссылку на медиа-эндпоинт
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                <div className="md:col-span-8">
                  <label className="text-xs text-slate-400 mb-1 block">URL эндпоинта:</label>
                  <input
                    type="text"
                    value={customUrl}
                    onChange={(e) => setCustomUrl(e.target.value)}
                    placeholder="/painting/image/2 или /video/file/1 или /model/file/1"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div className="md:col-span-4">
                  <label className="text-xs text-slate-400 mb-1 block">Ключ шифрования:</label>
                  <input
                    type="text"
                    value={customKey}
                    onChange={(e) => setCustomKey(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-amber-300 font-mono focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              {/* Quick Presets */}
              <div className="flex flex-wrap gap-2 text-xs pt-1">
                <span className="text-slate-500 self-center">Быстрые примеры:</span>
                <button
                  onClick={() => setCustomUrl('/painting/image/2')}
                  className="bg-slate-800 hover:bg-slate-700 px-3 py-1 rounded-lg border border-slate-700"
                >
                  🖼 Картина #2 (Куинджи)
                </button>
                <button
                  onClick={() => setCustomUrl('/model/file/1')}
                  className="bg-slate-800 hover:bg-slate-700 px-3 py-1 rounded-lg border border-slate-700"
                >
                  🗿 3D-Модель #1 (Эгирокассида)
                </button>
                <button
                  onClick={() => setCustomUrl('/video/file/1')}
                  className="bg-slate-800 hover:bg-slate-700 px-3 py-1 rounded-lg border border-slate-700"
                >
                  🎥 Видео #1 (Выставка)
                </button>
                <button
                  onClick={() => setCustomUrl('/video/file/4')}
                  className="bg-slate-800 hover:bg-slate-700 px-3 py-1 rounded-lg border border-slate-700"
                >
                  🎥 Видео #4 (История шедевра)
                </button>
              </div>

              <button
                onClick={handleDecryptCustomUrl}
                disabled={playerLoading}
                className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-medium py-3 rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-purple-600/25 text-sm"
              >
                {playerLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
                {playerLoading ? 'Загрузка и дешифрование...' : 'Стримить, расшифровать и воспроизвести'}
              </button>

              {/* Progress */}
              {playerLoading && (
                <div className="space-y-1.5 pt-2">
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>Потоковая загрузка сегментов (AES-256-CTR)</span>
                    <span className="font-mono text-purple-400">{playerProgress}%</span>
                  </div>
                  <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
                    <div
                      className="bg-gradient-to-r from-purple-500 to-emerald-400 h-2 rounded-full transition-all duration-150"
                      style={{ width: `${playerProgress}%` }}
                    ></div>
                  </div>
                </div>
              )}

              {playerStats && (
                <div className="text-xs text-slate-300 bg-slate-950 p-2.5 rounded-lg border border-slate-800 font-mono">
                  {playerStats}
                </div>
              )}
            </div>

            {/* Viewer Display */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 min-h-[440px] flex items-center justify-center">
              {playerResultUrl ? (
                playerContentType.includes('image') ? (
                  <img src={playerResultUrl} alt="Decrypted" className="max-h-[500px] rounded-xl object-contain shadow-2xl" />
                ) : playerContentType.includes('gltf') || playerContentType.includes('model') ? (
                  // @ts-ignore
                  <model-viewer
                    src={playerResultUrl}
                    alt="Decrypted 3D Model"
                    auto-rotate
                    camera-controls
                    shadow-intensity="1"
                    style={{ width: '100%', height: '460px' }}
                  // @ts-ignore
                  ></model-viewer>
                ) : (
                  <video src={playerResultUrl} controls autoPlay className="w-full max-h-[520px] rounded-xl bg-black shadow-2xl" />
                )
              ) : (
                <div className="text-center text-slate-600 space-y-2">
                  <Zap className="w-12 h-12 mx-auto text-slate-700" />
                  <p className="text-xs">Результат отобразится здесь после дешифрования</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Paintings */}
        {activeTab === 'paintings' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5 space-y-4">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold text-white flex items-center gap-2">
                    <ImageIcon className="w-5 h-5 text-indigo-400" />
                    Выбор картины
                  </h2>
                  <span className="text-xs text-slate-400">ID: {selectedPaintingId}</span>
                </div>

                <div className="space-y-2">
                  <label className="text-xs text-slate-400">Выберите из каталога или укажите ID (1 - 700):</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min="1"
                      max="700"
                      value={selectedPaintingId}
                      onChange={(e) => setSelectedPaintingId(Number(e.target.value))}
                      className="w-24 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 font-mono"
                    />
                    <select
                      value={selectedPaintingId}
                      onChange={(e) => setSelectedPaintingId(Number(e.target.value))}
                      className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 truncate"
                    >
                      {paintings.map((p) => (
                        <option key={p.id} value={p.id}>
                          #{p.id} - {p.title.slice(0, 45)}...
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {paintingInfo && (
                  <div className="space-y-3 pt-3 border-t border-slate-800 text-xs">
                    <div className="font-medium text-slate-200 text-sm">{paintingInfo.title}</div>
                    <div className="grid grid-cols-2 gap-2 text-slate-400">
                      <div><span className="text-slate-500">Художник:</span> {paintingInfo.artist || '—'}</div>
                      <div><span className="text-slate-500">Дата:</span> {paintingInfo.date || '—'}</div>
                      <div><span className="text-slate-500">Пропорции:</span> {paintingInfo.aspect_ratio || '—'}</div>
                      <div><span className="text-slate-500">Разрешение:</span> {paintingInfo.original_width}x{paintingInfo.original_height}</div>
                    </div>

                    <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-[11px] space-y-1">
                      <div className="text-indigo-400 flex items-center justify-between">
                        <span>GET /painting/info/{selectedPaintingId}</span>
                        <a href={`/painting/info/${selectedPaintingId}`} target="_blank" className="hover:underline flex items-center gap-0.5">
                          JSON <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      </div>
                      <div className="text-slate-400 flex items-center justify-between">
                        <span>GET /painting/image/{selectedPaintingId}</span>
                        <span className="text-emerald-400">Encrypted Stream</span>
                      </div>
                    </div>
                  </div>
                )}

                <button
                  onClick={handleDecryptPainting}
                  disabled={paintingLoading}
                  className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium py-2.5 px-4 rounded-lg transition shadow-lg shadow-indigo-600/20 text-sm"
                >
                  {paintingLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
                  {paintingLoading ? 'Дешифрование...' : 'Стримить и расшифровать картину'}
                </button>
              </div>
            </div>

            <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-400" />
                  Визуализатор потока картины
                </h3>
                {paintingIv && (
                  <span className="text-xs font-mono text-slate-400">
                    IV: <span className="text-amber-300">{paintingIv.slice(0, 12)}...</span>
                  </span>
                )}
              </div>

              {paintingLoading && (
                <div className="space-y-1.5 mb-4">
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>Потоковая передача сегментов</span>
                    <span className="font-mono text-indigo-400">{paintingProgress}%</span>
                  </div>
                  <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
                    <div
                      className="bg-gradient-to-r from-indigo-500 to-emerald-400 h-2 rounded-full transition-all duration-150"
                      style={{ width: `${paintingProgress}%` }}
                    ></div>
                  </div>
                </div>
              )}

              {paintingStats && (
                <div className="text-xs text-slate-300 mb-3 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80 font-mono">
                  {paintingStats}
                </div>
              )}

              <div className="flex-1 min-h-[360px] bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-center p-4 relative overflow-hidden">
                {decryptedPaintingUrl ? (
                  <img
                    src={decryptedPaintingUrl}
                    alt={paintingInfo?.title || 'Decrypted'}
                    className="max-h-[420px] max-w-full object-contain rounded-lg shadow-2xl"
                  />
                ) : (
                  <div className="text-center text-slate-600 space-y-2">
                    <Shield className="w-12 h-12 mx-auto text-slate-700" />
                    <p className="text-xs">Нажмите кнопку для запуска потока</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: 3D Models */}
        {activeTab === 'models' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5 space-y-4">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold text-white flex items-center gap-2">
                    <Box className="w-5 h-5 text-indigo-400" />
                    Выбор 3D-модели
                  </h2>
                  <span className="text-xs text-slate-400">ID: {selectedModelId} / 34</span>
                </div>

                <div className="space-y-2">
                  <label className="text-xs text-slate-400">Выберите модель из каталога:</label>
                  <select
                    value={selectedModelId}
                    onChange={(e) => setSelectedModelId(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 truncate"
                  >
                    {models.map((m) => (
                      <option key={m.id} value={m.id}>
                        #{m.id} - {m.title_ru} ({m.glb_size_mb} MB)
                      </option>
                    ))}
                  </select>
                </div>

                {modelInfo && (
                  <div className="space-y-3 pt-3 border-t border-slate-800 text-xs">
                    <div className="font-medium text-slate-200 text-sm">{modelInfo.title_ru}</div>
                    <div className="text-slate-400 text-xs italic">{modelInfo.title_en}</div>
                    <p className="text-slate-400 text-xs line-clamp-3">{modelInfo.description_ru || modelInfo.original_description}</p>
                    <div className="grid grid-cols-2 gap-2 text-slate-400 pt-1">
                      <div><span className="text-slate-500">Размер GLB:</span> {modelInfo.glb_size_mb} MB</div>
                      <div><span className="text-slate-500">Категория:</span> {modelInfo.category?.slice(0, 20)}...</div>
                    </div>

                    <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-[11px] space-y-1">
                      <div className="text-indigo-400 flex items-center justify-between">
                        <span>GET /model/info/{selectedModelId}</span>
                        <a href={`/model/info/${selectedModelId}`} target="_blank" className="hover:underline flex items-center gap-0.5">
                          JSON <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      </div>
                      <div className="text-slate-400 flex items-center justify-between">
                        <span>GET /model/file/{selectedModelId}</span>
                        <span className="text-emerald-400">Encrypted GLB Stream</span>
                      </div>
                    </div>
                  </div>
                )}

                <button
                  onClick={handleDecryptModel}
                  disabled={modelLoading}
                  className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium py-2.5 px-4 rounded-lg transition shadow-lg shadow-indigo-600/20 text-sm"
                >
                  {modelLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
                  {modelLoading ? 'Стриминг GLB...' : 'Стримить и расшифровать 3D-модель'}
                </button>
              </div>
            </div>

            <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Box className="w-4 h-4 text-emerald-400" />
                  Интерактивный 3D-просмотрщик (WebGL)
                </h3>
                {modelIv && (
                  <span className="text-xs font-mono text-slate-400">
                    IV: <span className="text-amber-300">{modelIv.slice(0, 12)}...</span>
                  </span>
                )}
              </div>

              {modelLoading && (
                <div className="space-y-1.5 mb-4">
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>Потоковая передача 3D-модели</span>
                    <span className="font-mono text-indigo-400">{modelProgress}%</span>
                  </div>
                  <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
                    <div
                      className="bg-gradient-to-r from-indigo-500 to-emerald-400 h-2 rounded-full transition-all duration-150"
                      style={{ width: `${modelProgress}%` }}
                    ></div>
                  </div>
                </div>
              )}

              {modelStats && (
                <div className="text-xs text-slate-300 mb-3 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80 font-mono">
                  {modelStats}
                </div>
              )}

              <div className="flex-1 min-h-[420px] bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-center p-4 relative overflow-hidden">
                {decryptedModelUrl ? (
                  // @ts-ignore
                  <model-viewer
                    src={decryptedModelUrl}
                    alt={modelInfo?.title_ru || '3D Model'}
                    auto-rotate
                    camera-controls
                    shadow-intensity="1"
                    style={{ width: '100%', height: '420px' }}
                  // @ts-ignore
                  ></model-viewer>
                ) : (
                  <div className="text-center text-slate-600 space-y-2">
                    <Box className="w-12 h-12 mx-auto text-slate-700" />
                    <p className="text-xs">Нажмите кнопку для загрузки 3D-модели</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Videos */}
        {activeTab === 'videos' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5 space-y-4">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold text-white flex items-center gap-2">
                    <Film className="w-5 h-5 text-indigo-400" />
                    Выбор видео
                  </h2>
                  <span className="text-xs text-slate-400">ID: {selectedVideoId} / 5</span>
                </div>

                <div className="space-y-2">
                  <label className="text-xs text-slate-400">Выберите видео из каталога:</label>
                  <select
                    value={selectedVideoId}
                    onChange={(e) => setSelectedVideoId(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 truncate"
                  >
                    {videos.map((v) => (
                      <option key={v.id} value={v.id}>
                        #{v.id} - {v.title} ({v.size_mb} MB)
                      </option>
                    ))}
                  </select>
                </div>

                {videoInfo && (
                  <div className="space-y-3 pt-3 border-t border-slate-800 text-xs">
                    <div className="font-medium text-slate-200 text-sm">{videoInfo.title}</div>
                    <div className="text-slate-400 text-xs">{videoInfo.description}</div>
                    <div className="grid grid-cols-2 gap-2 text-slate-400 pt-1">
                      <div><span className="text-slate-500">Размер:</span> {videoInfo.size_mb} MB</div>
                      <div><span className="text-slate-500">Категория:</span> {videoInfo.category}</div>
                    </div>

                    <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-[11px] space-y-1">
                      <div className="text-indigo-400 flex items-center justify-between">
                        <span>GET /video/info/{selectedVideoId}</span>
                        <a href={`/video/info/${selectedVideoId}`} target="_blank" className="hover:underline flex items-center gap-0.5">
                          JSON <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      </div>
                      <div className="text-slate-400 flex items-center justify-between">
                        <span>GET /video/file/{selectedVideoId}</span>
                        <span className="text-emerald-400">Encrypted MP4 Stream</span>
                      </div>
                    </div>
                  </div>
                )}

                <button
                  onClick={handleDecryptVideo}
                  disabled={videoLoading}
                  className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium py-2.5 px-4 rounded-lg transition shadow-lg shadow-indigo-600/20 text-sm"
                >
                  {videoLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
                  {videoLoading ? 'Стриминг и дешифрование видео...' : 'Стримить и расшифровать видео'}
                </button>
              </div>
            </div>

            <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Film className="w-4 h-4 text-emerald-400" />
                  Видеоплеер (HTML5)
                </h3>
                {videoIv && (
                  <span className="text-xs font-mono text-slate-400">
                    IV: <span className="text-amber-300">{videoIv.slice(0, 12)}...</span>
                  </span>
                )}
              </div>

              {videoLoading && (
                <div className="space-y-1.5 mb-4">
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>Загрузка зашифрованных сегментов видео</span>
                    <span className="font-mono text-indigo-400">{videoProgress}%</span>
                  </div>
                  <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
                    <div
                      className="bg-gradient-to-r from-indigo-500 to-emerald-400 h-2 rounded-full transition-all duration-150"
                      style={{ width: `${videoProgress}%` }}
                    ></div>
                  </div>
                </div>
              )}

              {videoStats && (
                <div className="text-xs text-slate-300 mb-3 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80 font-mono">
                  {videoStats}
                </div>
              )}

              <div className="flex-1 min-h-[420px] bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-center p-4 relative overflow-hidden">
                {decryptedVideoUrl ? (
                  <video
                    src={decryptedVideoUrl}
                    controls
                    autoPlay
                    className="w-full max-h-[460px] rounded-lg shadow-2xl bg-black"
                  ></video>
                ) : (
                  <div className="text-center text-slate-600 space-y-2">
                    <Film className="w-12 h-12 mx-auto text-slate-700" />
                    <p className="text-xs">Нажмите «Стримить и расшифровать видео» для запуска</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab 5: API Endpoints Table */}
        {activeTab === 'api' && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
            <div>
              <h2 className="text-lg font-bold text-white">Спецификация REST API и шифрования</h2>
              <p className="text-xs text-slate-400 mt-1">
                Все эндпоинты поддерживают потоковую передачу данных (chunked stream) с заголовками шифрования AES-256-CTR.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300 border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 bg-slate-950/50">
                    <th className="p-3 font-semibold">Метод</th>
                    <th className="p-3 font-semibold">Эндпоинт</th>
                    <th className="p-3 font-semibold">Формат ответа</th>
                    <th className="p-3 font-semibold">Описание</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  <tr>
                    <td className="p-3 font-mono text-emerald-400">GET</td>
                    <td className="p-3 font-mono text-indigo-300">/painting/image/:id</td>
                    <td className="p-3 font-mono text-slate-400">Stream (AES-256-CTR)</td>
                    <td className="p-3">Зашифрованный поток картины сегментами (64KB chunks).</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-mono text-emerald-400">GET</td>
                    <td className="p-3 font-mono text-indigo-300">/painting/info/:id</td>
                    <td className="p-3 font-mono text-amber-300">application/json</td>
                    <td className="p-3">Метаданные картины (название, автор, размеры, пропорции).</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-mono text-emerald-400">GET</td>
                    <td className="p-3 font-mono text-indigo-300">/model/file/:id</td>
                    <td className="p-3 font-mono text-slate-400">Stream (AES-256-CTR)</td>
                    <td className="p-3">Зашифрованный поток 3D-модели (.glb) сегментами (256KB chunks).</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-mono text-emerald-400">GET</td>
                    <td className="p-3 font-mono text-indigo-300">/model/info/:id</td>
                    <td className="p-3 font-mono text-amber-300">application/json</td>
                    <td className="p-3">Метаданные 3D-модели (описание, категория, размер).</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-mono text-emerald-400">GET</td>
                    <td className="p-3 font-mono text-indigo-300">/video/file/:id</td>
                    <td className="p-3 font-mono text-slate-400">Stream (AES-256-CTR)</td>
                    <td className="p-3">Зашифрованный поток видео (.mp4) сегментами (512KB chunks).</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-mono text-emerald-400">GET</td>
                    <td className="p-3 font-mono text-indigo-300">/video/info/:id</td>
                    <td className="p-3 font-mono text-amber-300">application/json</td>
                    <td className="p-3">Метаданные видео (название, описание, размер).</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-mono text-emerald-400">GET</td>
                    <td className="p-3 font-mono text-indigo-300">/api/catalog</td>
                    <td className="p-3 font-mono text-amber-300">application/json</td>
                    <td className="p-3">Сводный статус коллекций картин, 3D-моделей и видео.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 6: Code Examples */}
        {activeTab === 'code' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <FileCode className="w-4 h-4 text-amber-400" />
                Browser Web Crypto API (JavaScript)
              </h3>
              <pre className="bg-slate-950 p-4 rounded-lg text-xs font-mono text-slate-300 overflow-x-auto border border-slate-800">
{`// 1. Fetch stream (painting/model/video)
const res = await fetch('/video/file/1');
const ivHex = res.headers.get('X-Encryption-IV');
const buffer = await res.arrayBuffer();

// 2. Derive key
const keyData = new TextEncoder().encode('hhghghdgfjgfgdahgd');
const hash = await crypto.subtle.digest('SHA-256', keyData);
const cryptoKey = await crypto.subtle.importKey(
  'raw', hash, { name: 'AES-CTR' }, false, ['decrypt']
);

// 3. Decrypt
const ivBytes = new Uint8Array(
  ivHex.match(/.{1,2}/g).map(b => parseInt(b, 16))
);
const decrypted = await crypto.subtle.decrypt(
  { name: 'AES-CTR', counter: ivBytes, length: 128 },
  cryptoKey,
  buffer
);

// 4. Play video
const url = URL.createObjectURL(
  new Blob([decrypted], { type: 'video/mp4' })
);
document.getElementById('myVideo').src = url;`}
              </pre>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Server className="w-4 h-4 text-emerald-400" />
                Node.js Stream Decipher
              </h3>
              <pre className="bg-slate-950 p-4 rounded-lg text-xs font-mono text-slate-300 overflow-x-auto border border-slate-800">
{`const http = require('http');
const crypto = require('crypto');
const fs = require('fs');

http.get('http://localhost:3000/video/file/1', (res) => {
  const ivHex = res.headers['x-encryption-iv'];
  const key = crypto.createHash('sha256')
    .update('hhghghdgfjgfgdahgd')
    .digest();

  const decipher = crypto.createDecipheriv(
    'aes-256-ctr', key, Buffer.from(ivHex, 'hex')
  );
  
  res.pipe(decipher).pipe(fs.createWriteStream('video.mp4'));
});`}
              </pre>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-900/40 text-center py-4 text-xs text-slate-500">
        DAM Encrypted Media Backend • Next.js App Router • Vercel Ready
      </footer>
    </div>
  );
}
