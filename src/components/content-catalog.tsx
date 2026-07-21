'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ChevronRight, Edit3, Eye, Film, Grid2X2, ImageOff, Layers3, List, Loader2, MoreVertical, Play, Plus, Search, UploadCloud, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import Hls from 'hls.js';
import { api, apiError, type PageResult } from '@/lib/api';
import { EmptyState, ErrorState, LoadingState, PageHeader, StatusBadge, Toast } from './ui';
import { formatDate, formatNumber, slugify } from '@/lib/utils';

type AnyRecord = Record<string, any>;
type ContentKind = 'dramas' | 'seasons' | 'episodes';
type CatalogField = { name: string; label: string; type?: 'text' | 'number' | 'textarea' | 'select' | 'checkbox'; required?: boolean; options?: string[]; placeholder?: string };

const uploadChunkSize = 8 * 1024 * 1024;

function detectEpisodeMediaType(file: File): 'MP4' | 'HLS' | 'DASH' | 'OTHER' {
  const mime = file.type.toLowerCase();
  const name = file.name.toLowerCase();
  if (mime.includes('mpegurl') || name.endsWith('.m3u8')) return 'HLS';
  if (mime.includes('dash') || name.endsWith('.mpd')) return 'DASH';
  if (mime.includes('mp4') || name.endsWith('.mp4')) return 'MP4';
  return 'OTHER';
}

async function uploadEpisodeVideo(file: File, episodeId: string, onProgress?: (percent: number) => void) {
  const totalChunks = Math.ceil(file.size / uploadChunkSize);
  onProgress?.(1);
  const init = await api.post('/uploads/init', {
    purpose: 'episode_video',
    targetId: episodeId,
    originalName: file.name,
    mimeType: file.type || 'application/octet-stream',
    sizeBytes: file.size,
    totalChunks,
  });
  const uploadId = init.data.uploadId as string;
  for (let index = 0; index < totalChunks; index += 1) {
    const body = new FormData();
    body.append('chunk', file.slice(index * uploadChunkSize, Math.min(file.size, (index + 1) * uploadChunkSize)), file.name);
    body.append('chunkIndex', String(index));
    await api.post(`/uploads/${uploadId}/chunks`, body, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (event) => {
        const chunkProgress = event.total ? event.loaded / event.total : 0;
        onProgress?.(Math.min(99, Math.round(((index + chunkProgress) / totalChunks) * 100)));
      },
    });
  }
  const result = await api.post(`/uploads/${uploadId}/complete`, { targetId: episodeId });
  onProgress?.(100);
  return result;
}

const fields: Record<ContentKind, CatalogField[]> = {
  dramas: [
    { name: 'name', label: 'Drama name', required: true },
    { name: 'slug', label: 'URL slug', required: true, placeholder: 'my-drama' },
    { name: 'description', label: 'Description', type: 'textarea' },
    { name: 'dramaNumber', label: 'Drama number', type: 'number' },
    { name: 'totalSeasons', label: 'Total seasons', type: 'number' },
    { name: 'thumbnailKey', label: 'Thumbnail URL or storage key' },
    { name: 'isPublished', label: 'Published', type: 'checkbox' },
  ],
  seasons: [
    { name: 'seasonNumber', label: 'Season number', type: 'number', required: true },
    { name: 'totalEpisodes', label: 'Total episodes', type: 'number' },
    { name: 'title', label: 'Title' },
    { name: 'thumbnailKey', label: 'Thumbnail URL or storage key' },
  ],
  episodes: [
    { name: 'episodeNumber', label: 'Episode number', type: 'number', required: true },
    { name: 'title', label: 'Title' },
    { name: 'description', label: 'Description', type: 'textarea' },
    { name: 'thumbnailKey', label: 'Thumbnail URL or storage key' },
    { name: 'visibility', label: 'Visibility', type: 'select', options: ['PUBLIC', 'PRIVATE'] },
    { name: 'isPremium', label: 'Premium', type: 'checkbox' },
    { name: 'isPublished', label: 'Published', type: 'checkbox' },
    { name: 'downloadAccess', label: 'Download access', type: 'select', options: ['GALLERY', 'APP_STORAGE', 'BOTH', 'NEVER'] },
  ],
};

const endpoints: Record<ContentKind, string> = { dramas: '/dramas', seasons: '/seasons', episodes: '/episodes' };

export function ContentCatalog() {
  const client = useQueryClient();
  const [tab, setTab] = useState<ContentKind>('dramas');
  const [search, setSearch] = useState('');
  const [selectedDrama, setSelectedDrama] = useState<AnyRecord | null>(null);
  const [selectedSeason, setSelectedSeason] = useState<AnyRecord | null>(null);
  const [form, setForm] = useState<{ kind: ContentKind; editing: AnyRecord | null } | null>(null);
  const [notice, setNotice] = useState('');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  const dramasQuery = useQuery<PageResult<AnyRecord>>({
    queryKey: ['catalog-dramas', search],
    queryFn: async () => (await api.get('/dramas', { params: { page: 1, limit: 100, search: search || undefined } })).data,
  });
  const seasonsQuery = useQuery<PageResult<AnyRecord>>({
    queryKey: ['catalog-seasons', selectedDrama?.id],
    queryFn: async () => (await api.get('/seasons', { params: { page: 1, limit: 100, dramaId: selectedDrama?.id } })).data,
    enabled: Boolean(selectedDrama?.id),
  });
  const episodesQuery = useQuery<PageResult<AnyRecord>>({
    queryKey: ['catalog-episodes', selectedSeason?.id],
    queryFn: async () => (await api.get('/episodes', { params: { page: 1, limit: 100, seasonId: selectedSeason?.id } })).data,
    enabled: Boolean(selectedSeason?.id),
  });

  const save = useMutation({
    mutationFn: async ({ kind, editing, payload, videoFile }: { kind: ContentKind; editing: AnyRecord | null; payload: AnyRecord; videoFile?: File | null }) => {
      setUploadProgress(videoFile ? 0 : null);
      const response = editing ? await api.patch(`${endpoints[kind]}/${editing.id}`, payload) : await api.post(endpoints[kind], payload);
      const record = response.data as AnyRecord;
      if (kind === 'episodes' && videoFile) {
        const episodeId = record.id ?? editing?.id;
        if (!episodeId) throw new Error('Episode id missing after save.');
        const uploadResult = await uploadEpisodeVideo(videoFile, episodeId, setUploadProgress);
        if (uploadResult.data?.encryptedLocator) {
          const mediaPayload = {
            episodeId,
            mediaType: detectEpisodeMediaType(videoFile),
            provider: 'storage',
            encryptedLocator: uploadResult.data.encryptedLocator,
            status: 'ACTIVE',
          };
          if (editing?.mediaAsset?.id) await api.patch(`/media-assets/${editing.mediaAsset.id}`, mediaPayload);
          else await api.post('/media-assets', mediaPayload);
        }
      }
      return record;
    },
    onSuccess: (_data, variables) => {
      setForm(null);
      setUploadProgress(null);
      setNotice(`${variables.kind.slice(0, -1)} ${variables.editing ? 'updated' : 'created'} successfully.`);
      void client.invalidateQueries({ queryKey: ['catalog-dramas'] });
      void client.invalidateQueries({ queryKey: ['catalog-seasons'] });
      void client.invalidateQueries({ queryKey: ['catalog-episodes'] });
    },
    onError: (error) => {
      setUploadProgress(null);
      setNotice(apiError(error));
    },
  });

  const dramas = dramasQuery.data?.items ?? [];
  const seasons = seasonsQuery.data?.items ?? [];
  const episodes = episodesQuery.data?.items ?? [];
  const currentLabel = tab === 'dramas' ? 'Drama' : tab === 'seasons' ? 'Season' : 'Episode';

  function showSeasons(drama: AnyRecord) {
    setSelectedDrama(drama);
    setSelectedSeason(null);
    setTab('seasons');
  }
  function showEpisodes(season: AnyRecord) {
    setSelectedSeason(season);
    setTab('episodes');
  }
  function backToDramas() {
    setSelectedDrama(null);
    setSelectedSeason(null);
    setTab('dramas');
  }
  function backToSeasons() {
    setSelectedSeason(null);
    setTab('seasons');
  }

  return <div>
    <PageHeader
      eyebrow="Library"
      title="Content library"
      description="Browse the catalog visually: drama, season, then episode. Each relationship is selected by name instead of a raw ID."
      actions={<><div className="hidden items-center border border-line bg-white p-1 sm:flex"><button className={`btn-quiet h-8 w-8 p-0 ${view === 'grid' ? 'bg-ink text-white' : ''}`} onClick={() => setView('grid')} aria-label="Grid view"><Grid2X2 size={15} /></button><button className={`btn-quiet h-8 w-8 p-0 ${view === 'list' ? 'bg-ink text-white' : ''}`} onClick={() => setView('list')} aria-label="List view"><List size={15} /></button></div><button className="btn-primary" onClick={() => setForm({ kind: tab, editing: null })}><Plus size={16} /> Add {currentLabel}</button></>}
    />

    <div className="mb-5 flex flex-wrap items-center gap-1 border-b border-line">
      {(['dramas', 'seasons', 'episodes'] as ContentKind[]).map((item) => <button key={item} onClick={() => setTab(item)} className={`border-b-2 px-4 py-3 text-sm font-semibold capitalize ${tab === item ? 'border-brand text-brand' : 'border-transparent text-slate-500'}`}>{item}</button>)}
    </div>

    {(selectedDrama || selectedSeason) && <div className="mb-5 flex flex-wrap items-center gap-2 text-sm"><button className="btn-quiet h-8 px-2" onClick={backToDramas}><ArrowLeft size={14} /> Dramas</button>{selectedDrama && <><ChevronRight size={14} className="text-slate-400" /><button className={tab === 'seasons' ? 'font-semibold text-brand' : 'text-slate-500'} onClick={backToSeasons}>{selectedDrama.name}</button></>}{selectedSeason && <><ChevronRight size={14} className="text-slate-400" /><span className="font-semibold text-ink">Season {selectedSeason.seasonNumber}</span></>}</div>}

    {tab === 'dramas' && <><div className="mb-5 flex max-w-2xl items-center gap-2"><div className="relative flex-1"><Search className="absolute left-3 top-2.5 text-slate-400" size={16} /><input className="input pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search dramas..." /></div></div>{dramasQuery.isLoading ? <LoadingState label="Loading drama library" /> : dramasQuery.isError ? <ErrorState message={apiError(dramasQuery.error)} onRetry={() => dramasQuery.refetch()} /> : dramas.length ? <DramaCards dramas={dramas} view={view} onViewSeasons={showSeasons} onEdit={(drama) => setForm({ kind: 'dramas', editing: drama })} /> : <EmptyState title="No dramas found" description="Create your first drama to start building the season and episode hierarchy." action={<button className="btn-primary" onClick={() => setForm({ kind: 'dramas', editing: null })}><Plus size={15} /> Add drama</button>} />}</>}

    {tab === 'seasons' && <>{selectedDrama ? <><CatalogContextCard type="drama" record={selectedDrama} onEdit={() => setForm({ kind: 'dramas', editing: selectedDrama })} /><div className="mb-4 flex items-center justify-between"><div><div className="eyebrow">Seasons</div><h3 className="mt-1 text-xl font-bold">Seasons in {selectedDrama.name}</h3></div><button className="btn-primary" onClick={() => setForm({ kind: 'seasons', editing: null })}><Plus size={15} /> Add season</button></div>{seasonsQuery.isLoading ? <LoadingState label="Loading seasons" /> : seasonsQuery.isError ? <ErrorState message={apiError(seasonsQuery.error)} onRetry={() => seasonsQuery.refetch()} /> : seasons.length ? <SeasonCards seasons={seasons} view={view} onViewEpisodes={showEpisodes} onEdit={(season) => setForm({ kind: 'seasons', editing: season })} /> : <EmptyState title="No seasons yet" description="Add the first season under this drama." action={<button className="btn-primary" onClick={() => setForm({ kind: 'seasons', editing: null })}><Plus size={15} /> Add season</button>} />}</> : <ChooseParent title="Choose a drama" description="Select a drama card first, then its seasons will appear here." dramas={dramas} onChoose={showSeasons} />}</>}

    {tab === 'episodes' && <>{selectedSeason && selectedDrama ? <><CatalogContextCard type="season" record={selectedSeason} parent={selectedDrama} onEdit={() => setForm({ kind: 'seasons', editing: selectedSeason })} /><div className="mb-4 flex items-center justify-between"><div><div className="eyebrow">Episodes</div><h3 className="mt-1 text-xl font-bold">Episodes in Season {selectedSeason.seasonNumber}</h3></div><button className="btn-primary" onClick={() => setForm({ kind: 'episodes', editing: null })}><Plus size={15} /> Add episode</button></div>{episodesQuery.isLoading ? <LoadingState label="Loading episodes" /> : episodesQuery.isError ? <ErrorState message={apiError(episodesQuery.error)} onRetry={() => episodesQuery.refetch()} /> : episodes.length ? <EpisodeCards episodes={episodes} view={view} onEdit={(episode) => setForm({ kind: 'episodes', editing: episode })} /> : <EmptyState title="No episodes yet" description="Add the first episode under this season." action={<button className="btn-primary" onClick={() => setForm({ kind: 'episodes', editing: null })}><Plus size={15} /> Add episode</button>} />}</> : <ChooseParent title="Choose a season" description="Open a drama and choose one of its seasons to see the episodes." dramas={dramas} onChoose={showSeasons} />}</>}

    {form && <CatalogForm kind={form.kind} editing={form.editing} dramas={dramas} onCancel={() => setForm(null)} onSubmit={(payload, videoFile) => save.mutate({ kind: form.kind, editing: form.editing, payload, videoFile })} submitting={save.isPending} uploadProgress={uploadProgress} />}
    {notice && <Toast message={notice} kind={notice.includes('successfully') ? 'success' : 'error'} />}
  </div>;
}

function DramaCards({ dramas, view, onViewSeasons, onEdit }: { dramas: AnyRecord[]; view: 'grid' | 'list'; onViewSeasons: (drama: AnyRecord) => void; onEdit: (drama: AnyRecord) => void }) {
  return <div className={view === 'grid' ? 'grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4' : 'space-y-3'}>{dramas.map((drama) => <article key={drama.id} className={view === 'grid' ? 'surface overflow-hidden' : 'surface flex items-center gap-4 overflow-hidden p-3'}><CatalogThumbnail src={drama.thumbnailKey} label={drama.name} compact={view === 'list'} /><div className={view === 'grid' ? 'p-4' : 'min-w-0 flex-1'}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="truncate text-lg font-bold text-ink">{drama.name}</h3><p className="mt-1 truncate text-sm text-slate-500">{drama.description || drama.slug}</p></div><StatusBadge value={drama.isPublished ? 'PUBLISHED' : 'DRAFT'} /></div><div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs font-semibold text-slate-600"><span className="inline-flex items-center gap-1.5"><Layers3 size={14} className="text-brand" /> {formatNumber(drama._count?.seasons ?? drama.totalSeasons)} seasons</span><span className="inline-flex items-center gap-1.5"><Film size={14} className="text-brand" /> Catalog</span></div><div className="mt-4 flex items-center gap-2 border-t border-line pt-3"><button className="btn-secondary h-9 flex-1 justify-center text-brand" onClick={() => onViewSeasons(drama)}><Eye size={14} /> View seasons</button><button className="btn-quiet h-9 w-9 p-0" onClick={() => onEdit(drama)} aria-label={`Edit ${drama.name}`}><Edit3 size={14} /></button><button className="btn-quiet h-9 w-9 p-0" aria-label="More drama actions"><MoreVertical size={14} /></button></div></div></article>)}</div>;
}

function SeasonCards({ seasons, view, onViewEpisodes, onEdit }: { seasons: AnyRecord[]; view: 'grid' | 'list'; onViewEpisodes: (season: AnyRecord) => void; onEdit: (season: AnyRecord) => void }) {
  return <div className={view === 'grid' ? 'grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4' : 'space-y-3'}>{seasons.map((season) => <article key={season.id} className={view === 'grid' ? 'surface overflow-hidden' : 'surface flex items-center gap-4 p-3'}><CatalogThumbnail src={season.thumbnailKey} label={`Season ${season.seasonNumber}`} compact={view === 'list'} /><div className={view === 'grid' ? 'p-4' : 'min-w-0 flex-1'}><div className="flex items-start justify-between gap-3"><div><h3 className="text-lg font-bold text-ink">Season {season.seasonNumber}</h3><p className="mt-1 text-sm text-slate-500">{season.title || 'Untitled season'}</p></div><Layers3 className="text-brand" size={18} /></div><div className="mt-4 flex items-center gap-2 text-xs font-semibold text-slate-600"><Film size={14} className="text-brand" /> {formatNumber(season._count?.episodes ?? season.totalEpisodes)} episodes</div><div className="mt-4 flex items-center gap-2 border-t border-line pt-3"><button className="btn-secondary h-9 flex-1 justify-center text-brand" onClick={() => onViewEpisodes(season)}><Eye size={14} /> View episodes</button><button className="btn-quiet h-9 w-9 p-0" onClick={() => onEdit(season)} aria-label={`Edit season ${season.seasonNumber}`}><Edit3 size={14} /></button></div></div></article>)}</div>;
}

function EpisodeCards({ episodes, view, onEdit }: { episodes: AnyRecord[]; view: 'grid' | 'list'; onEdit: (episode: AnyRecord) => void }) {
  const [playing, setPlaying] = useState<string | null>(null);
  return <div className={view === 'grid' ? 'grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4' : 'space-y-3'}>{episodes.map((episode) => <article key={episode.id} className={view === 'grid' ? 'surface overflow-hidden' : 'surface flex items-center gap-4 p-3'}><CatalogThumbnail src={episode.thumbnailKey} label={`Episode ${episode.episodeNumber}`} compact={view === 'list'} /><div className={view === 'grid' ? 'p-4' : 'min-w-0 flex-1'}><div className="flex items-start justify-between gap-3"><div><h3 className="text-lg font-bold text-ink">Episode {episode.episodeNumber}</h3><p className="mt-1 truncate text-sm text-slate-500">{episode.title || 'Untitled episode'}</p></div><StatusBadge value={episode.status ?? (episode.isPublished ? 'PUBLISHED' : 'DRAFT')} /></div>{playing === episode.id ? <SecureEpisodePlayer episode={episode} onClose={() => setPlaying(null)} /> : <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-slate-600"><StatusBadge value={episode.visibility} /><StatusBadge value={episode.isPremium ? 'PREMIUM' : 'FREE'} /><span className="inline-flex items-center gap-1.5"><Film size={14} className="text-brand" /> {episode.mediaAsset?.mediaType ?? 'No media'}</span></div>}<div className="mt-4 flex items-center gap-2 border-t border-line pt-3"><button className="btn-primary h-9 flex-1 justify-center" disabled={!episode.mediaAsset} onClick={() => setPlaying(episode.id)}><Play size={14} /> Play episode</button><button className="btn-quiet h-9 w-9 p-0" onClick={() => onEdit(episode)} aria-label={`Edit episode ${episode.episodeNumber}`}><Edit3 size={14} /></button></div></div></article>)}</div>;
}

function CatalogThumbnail({ src, label, compact = false }: { src?: string | null; label: string; compact?: boolean }) {
  const [failed, setFailed] = useState(false);
  const valid = Boolean(src && (/^https?:\/\//i.test(src) || src.startsWith('/')));
  return <div className={`${compact ? 'h-20 w-28 shrink-0' : 'aspect-[16/8]'} relative flex items-center justify-center overflow-hidden bg-ink text-white`}><div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-ink/95 text-white/80"><Film size={compact ? 18 : 26} /><span className="max-w-[85%] truncate text-xs font-semibold">{label}</span></div>{valid && !failed && <img src={src!} alt={`${label} thumbnail`} className="relative h-full w-full object-cover" onError={() => setFailed(true)} />}{(!valid || failed) && <div className="absolute right-2 top-2 bg-black/40 p-1"><ImageOff size={13} /></div>}</div>;
}

function CatalogContextCard({ type, record, parent, onEdit }: { type: 'drama' | 'season'; record: AnyRecord; parent?: AnyRecord; onEdit: () => void }) { return <section className="surface mb-6 flex flex-col gap-4 p-4 sm:flex-row sm:items-center"><CatalogThumbnail src={record.thumbnailKey} label={type === 'drama' ? record.name : `Season ${record.seasonNumber}`} compact /><div className="min-w-0 flex-1"><div className="eyebrow">Selected {type}</div><h3 className="mt-1 truncate text-xl font-bold">{type === 'drama' ? record.name : `${parent?.name ?? 'Drama'} / Season ${record.seasonNumber}`}</h3><p className="mt-1 text-sm text-slate-500">{type === 'drama' ? `${formatNumber(record._count?.seasons ?? record.totalSeasons)} seasons in this drama` : record.title || 'Episodes for this season'}</p></div><button className="btn-secondary" onClick={onEdit}><Edit3 size={15} /> Edit</button></section>; }

function ChooseParent({ title, description, dramas, onChoose }: { title: string; description: string; dramas: AnyRecord[]; onChoose: (drama: AnyRecord) => void }) { return <section className="surface p-8"><div className="mb-5"><div className="eyebrow">Catalog navigation</div><h3 className="mt-1 text-xl font-bold">{title}</h3><p className="mt-1 text-sm text-slate-500">{description}</p></div>{dramas.length ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{dramas.map((drama) => <button key={drama.id} className="flex items-center gap-3 border border-line bg-white p-3 text-left transition hover:border-brand" onClick={() => onChoose(drama)}><CatalogThumbnail src={drama.thumbnailKey} label={drama.name} compact /><span className="min-w-0 flex-1 truncate text-sm font-semibold">{drama.name}</span><ChevronRight size={15} className="text-slate-400" /></button>)}</div> : <EmptyState title="No dramas available" description="Create a drama before adding seasons or episodes." />}</section>; }

function CatalogForm({ kind, editing, dramas, onCancel, onSubmit, submitting, uploadProgress }: { kind: ContentKind; editing: AnyRecord | null; dramas: AnyRecord[]; onCancel: () => void; onSubmit: (payload: AnyRecord, videoFile?: File | null) => void; submitting: boolean; uploadProgress?: number | null }) {
  const initialDramaId = kind === 'seasons' ? editing?.dramaId ?? editing?.drama?.id ?? '' : kind === 'episodes' ? editing?.season?.drama?.id ?? '' : '';
  const [values, setValues] = useState<AnyRecord>(() => ({ ...editing, dramaId: initialDramaId, seasonId: kind === 'episodes' ? editing?.seasonId ?? '' : undefined }));
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [formError, setFormError] = useState('');
  const seasonsQuery = useQuery<PageResult<AnyRecord>>({ queryKey: ['catalog-form-seasons', values.dramaId], queryFn: async () => (await api.get('/seasons', { params: { page: 1, limit: 100, dramaId: values.dramaId } })).data, enabled: kind === 'episodes' && Boolean(values.dramaId) });
  const seasons = seasonsQuery.data?.items ?? [];

  function change(name: string, value: string | number | boolean) {
    setValues((current) => ({ ...current, [name]: value, ...(name === 'dramaId' && kind === 'episodes' ? { seasonId: '' } : {}) }));
  }

  function submit() {
    const parentMissing = kind === 'seasons' ? !values.dramaId : kind === 'episodes' ? !values.seasonId : false;
    const missing = fields[kind].find((field) => field.required && String(values[field.name] ?? '').trim() === '');
    if (parentMissing || missing) {
      setFormError(parentMissing ? kind === 'seasons' ? 'Choose a drama first.' : 'Choose a season first.' : `${missing?.label} is required.`);
      return;
    }
    const names = fields[kind].map((field) => field.name);
    const parentNames = kind === 'seasons' ? ['dramaId'] : kind === 'episodes' ? ['seasonId'] : [];
    const payload = Object.fromEntries(
      [...parentNames, ...names]
        .map((name) => [name, values[name]] as const)
        .filter(([, value]) => value !== '' && value !== undefined && value !== null),
    );
    if (kind === 'dramas') {
      payload.slug = slugify(String(payload.slug ?? payload.name ?? ''));
      if (!payload.slug) {
        setFormError('URL slug is required.');
        return;
      }
    }
    onSubmit(payload, videoFile);
  }

  return (
    <section className="surface mb-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="eyebrow">Secure form</div>
          <h3 className="mt-1 text-lg font-bold">{editing ? 'Edit' : 'Add'} {kind === 'dramas' ? 'drama' : kind === 'seasons' ? 'season' : 'episode'}</h3>
          <p className="mt-1 text-sm text-slate-500">Select relationships by name. The backend still validates every parent relationship.</p>
        </div>
        <button className="btn-quiet h-8 w-8 p-0" onClick={onCancel} aria-label="Close form"><X size={16} /></button>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {kind !== 'dramas' && (
          <label>
            <span className="mb-2 block text-sm font-semibold">Drama <span className="text-brand">*</span></span>
            <select className="select" value={values.dramaId ?? ''} onChange={(event) => change('dramaId', event.target.value)}>
              <option value="">{dramas.length ? 'Select a drama' : 'No dramas found'}</option>
              {dramas.map((drama) => <option key={drama.id} value={drama.id}>{drama.name}</option>)}
            </select>
          </label>
        )}

        {kind === 'episodes' && (
          <label>
            <span className="mb-2 block text-sm font-semibold">Season <span className="text-brand">*</span></span>
            <select className="select" value={values.seasonId ?? ''} disabled={!values.dramaId || seasonsQuery.isLoading} onChange={(event) => change('seasonId', event.target.value)}>
              <option value="">{!values.dramaId ? 'Select a drama first' : seasonsQuery.isLoading ? 'Loading seasons...' : 'Select a season'}</option>
              {seasons.map((season) => <option key={season.id} value={season.id}>Season {season.seasonNumber}{season.title ? ` - ${season.title}` : ''}</option>)}
            </select>
          </label>
        )}

        {fields[kind].map((field) => (
          <label key={field.name} className={field.type === 'textarea' ? 'md:col-span-2' : ''}>
            <span className="mb-2 block text-sm font-semibold">{field.label}{field.required && <span className="text-brand"> *</span>}</span>
            {field.type === 'textarea' ? (
              <textarea className="input min-h-28 py-2" value={values[field.name] ?? ''} onChange={(event) => change(field.name, event.target.value)} placeholder={field.placeholder} />
            ) : field.type === 'select' ? (
              <select className="select" value={values[field.name] ?? ''} onChange={(event) => change(field.name, event.target.value)}>
                <option value="">Select one</option>
                {field.options?.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            ) : field.type === 'checkbox' ? (
              <div className="flex h-10 items-center gap-2">
                <input type="checkbox" checked={Boolean(values[field.name])} onChange={(event) => change(field.name, event.target.checked)} className="h-4 w-4 accent-teal" />
                <span className="text-sm text-slate-500">Enabled</span>
              </div>
            ) : (
              <input className="input" type={field.type ?? 'text'} value={values[field.name] ?? ''} onChange={(event) => change(field.name, field.type === 'number' ? (event.target.value === '' ? '' : Number(event.target.value)) : event.target.value)} placeholder={field.placeholder} />
            )}
          </label>
        ))}

        {kind === 'episodes' && (
          <div className="md:col-span-2 rounded border border-line bg-slate-50 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-ink">
              <UploadCloud size={16} className="text-brand" /> Episode video
            </div>
            <p className="mt-1 text-xs text-slate-500">Pick the playable file here. It will attach to the episode after save.</p>
            <label className="mt-4 block">
              <span className="mb-2 block text-sm font-semibold">Video file</span>
              <input className="input h-auto py-2" type="file" accept="video/*,.m3u8,.mpd" onChange={(event) => setVideoFile(event.target.files?.[0] ?? null)} />
            </label>
            {videoFile && (
              <div className="mt-4 border border-line bg-white p-3 text-sm">
                <div className="flex items-center gap-3">
                  <UploadCloud size={18} className="text-teal" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{videoFile.name}</div>
                    <div className="text-xs text-slate-500">{formatNumber(videoFile.size / 1024 / 1024)} MB</div>
                  </div>
                  <StatusBadge value={detectEpisodeMediaType(videoFile)} />
                </div>
                {uploadProgress !== null && uploadProgress !== undefined && (
                  <div className="mt-4">
                    <div className="mb-2 flex items-center justify-between text-xs font-semibold">
                      <span>{uploadProgress >= 100 ? 'Upload complete' : 'Uploading video'}</span>
                      <span className="text-brand">{uploadProgress}%</span>
                    </div>
                    <div className="h-2 overflow-hidden bg-slate-100">
                      <div className="h-full bg-teal transition-all" style={{ width: `${uploadProgress}%` }} />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {formError && <div className="mt-4 border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</div>}

      <div className="mt-6 flex justify-end gap-2">
        <button className="btn-secondary" onClick={onCancel}>Cancel</button>
        <button className="btn-primary" disabled={submitting} onClick={submit}>
          {submitting ? <Loader2 className="animate-spin" size={15} /> : <Plus size={15} />}
          {submitting ? 'Saving...' : 'Save record'}
        </button>
      </div>
    </section>
  );
}

function SecureEpisodePlayer({ episode, onClose }: { episode: AnyRecord; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [session, setSession] = useState<AnyRecord | null>(null);
  const [source, setSource] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const sourceRef = useRef('');
  const device = useMemo(() => ({ deviceId: 'admin-preview-device', fingerprint: typeof navigator === 'undefined' ? 'admin-preview-fingerprint-0000' : `admin-preview-${navigator.userAgent}-${window.innerWidth}x${window.innerHeight}`.slice(0, 512) }), []);

  useEffect(() => {
    let cancelled = false;
    async function start() {
      try {
        const response = await api.post(`/playback/episodes/${episode.id}/session`, device);
        if (cancelled) return;
        const playback = response.data;
        setSession(playback);
        if (playback.mediaType === 'MP4') {
          const media = await fetch(playback.gatewayUrl, { headers: { Authorization: `Bearer ${playback.playbackToken}`, 'x-device-id': device.deviceId, 'x-device-fingerprint': device.fingerprint } });
          if (!media.ok) throw new Error('Secure media request was rejected.');
          const blob = await media.blob();
          if (!cancelled) { const objectUrl = URL.createObjectURL(blob); sourceRef.current = objectUrl; setSource(objectUrl); }
        } else if (playback.mediaType === 'HLS' && videoRef.current && Hls.isSupported()) {
          const hls = new Hls({ xhrSetup: (xhr) => { xhr.setRequestHeader('Authorization', `Bearer ${playback.playbackToken}`); xhr.setRequestHeader('x-device-id', device.deviceId); xhr.setRequestHeader('x-device-fingerprint', device.fingerprint); } });
          hlsRef.current = hls;
          hls.loadSource(playback.gatewayUrl);
          hls.attachMedia(videoRef.current);
        } else if (playback.mediaType === 'HLS') {
          throw new Error('This browser does not support secure HLS preview.');
        } else {
          throw new Error('This media type cannot be previewed in the panel.');
        }
      } catch (requestError) { if (!cancelled) setError(apiError(requestError)); } finally { if (!cancelled) setLoading(false); }
    }
    void start();
    return () => { cancelled = true; hlsRef.current?.destroy(); if (sourceRef.current) URL.revokeObjectURL(sourceRef.current); };
  }, [device, episode.id]);

  async function close() { if (session) { try { await api.delete(`/playback/sessions/${session.playbackSessionId}`, { headers: { 'x-playback-token': session.playbackToken }, data: device }); } catch { /* session expiry also revokes short-lived capability */ } } onClose(); }
  return <div className="mt-4 border border-ink/10 bg-ink p-2"><div className="relative aspect-video overflow-hidden bg-black">{source && <video ref={videoRef} className="h-full w-full" src={source} controls autoPlay playsInline onError={() => setError('The secure media stream could not be played.')} />}{session?.mediaType === 'HLS' && <video ref={videoRef} className="h-full w-full" controls autoPlay playsInline />}{loading && <div className="absolute inset-0 flex items-center justify-center gap-2 bg-ink text-sm text-white"><Loader2 className="animate-spin" size={18} /> Authorizing secure playback...</div>}{error && <div className="absolute inset-0 flex items-center justify-center bg-ink px-5 text-center text-sm text-white">{error}</div>}</div><div className="flex items-center justify-between gap-2 px-1 pt-2 text-xs text-white/70"><span>{session ? 'Short-lived secure preview' : 'Playback authorization'}</span><button className="btn-quiet h-8 border-white/10 bg-white/10 px-2 text-white hover:bg-white/20" onClick={() => void close()}><X size={14} /> Close</button></div></div>;
}
