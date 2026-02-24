import { useState, useEffect, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Plus, FileVideo, FileImage, RefreshCw } from 'lucide-react';
import Navbar from '@/components/Navbar';
import MediaGrid from '@/components/MediaGrid';
import UploadModal from '@/components/UploadModal';
import OperationModal from '@/components/OperationModal';
import CropModal from '@/components/CropModal';
import { useSocket } from '@/hooks/useSocket';
import { Toaster, toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import * as api from '@/api/client';

export default function DashboardPage() {
  const [videos, setVideos] = useState([]);
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('videos');

  // Upload modal
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadType, setUploadType] = useState('video');

  // Operation modal
  const [opOpen, setOpOpen] = useState(false);
  const [opType, setOpType] = useState('');
  const [opTarget, setOpTarget] = useState(null);

  // Crop modal
  const [cropOpen, setCropOpen] = useState(false);
  const [cropTarget, setCropTarget] = useState(null);

  // Auth
  const { refreshUser } = useAuth();

  // WebSocket
  const { jobs, subscribe } = useSocket();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [vData, iData] = await Promise.all([api.getVideos(), api.getImages()]);
      const videoList = vData.videos || vData || [];
      const imageList = iData.images || iData || [];
      setVideos(videoList);
      setImages(imageList);

      // Subscribe to all resource IDs for real-time updates
      videoList.forEach((v) => subscribe(v.videoId || v.video_id));
      imageList.forEach((i) => subscribe(i.image_id || i.imageId));
    } catch (err) {
      toast.error('Failed to load media', { description: err.message });
    } finally {
      setLoading(false);
    }
  }, [subscribe]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Watch for completed/failed jobs
  useEffect(() => {
    Object.entries(jobs).forEach(([id, job]) => {
      if (job.event === 'completed') {
        toast.success('Processing complete', { description: `Job for ${id} finished.` });
        fetchData();
        refreshUser();
      } else if (job.event === 'failed') {
        toast.error('Processing failed', { description: job.error || `Job for ${id} failed.` });
        refreshUser();
      }
    });
  }, [jobs, fetchData]);

  const handleUpload = async (file) => {
    if (uploadType === 'video') {
      await api.uploadVideo(file);
    } else {
      await api.uploadImage(file);
    }
    toast.success('Upload complete');
    fetchData();
  };

  const handleOperation = (operation, item) => {
    if (operation === 'cropImage') {
      setCropTarget(item);
      setCropOpen(true);
      return;
    }
    setOpType(operation);
    setOpTarget(item);
    setOpOpen(true);
  };

  const handleCropSubmit = async ({ x, y, width, height }) => {
    const id = cropTarget.image_id || cropTarget.imageId;
    await api.cropImage(id, width, height, x, y);
    toast.success('Crop job started', { description: 'Processing has begun.' });
    subscribe(id);
    fetchData();
    refreshUser();
  };

  const handleOperationSubmit = async (values) => {
    const id = opTarget.videoId || opTarget.video_id || opTarget.image_id || opTarget.imageId;
    switch (opType) {
      case 'resizeVideo':
        await api.resizeVideo(id, parseInt(values.width), parseInt(values.height));
        break;
      case 'convertVideo':
        await api.convertVideo(id, values.format);
        break;
      case 'extractAudio':
        await api.extractAudio(id, values.format);
        break;
      case 'resizeImage':
        await api.resizeImage(id, parseInt(values.width), parseInt(values.height));
        break;
      case 'convertImage':
        await api.convertImage(id, values.format);
        break;
      case 'cropImage':
        await api.cropImage(id, parseInt(values.width), parseInt(values.height), parseInt(values.x), parseInt(values.y));
        break;
      default:
        break;
    }
    toast.success('Job started', { description: 'Processing has begun. You\'ll see progress updates below.' });
    subscribe(id);
    fetchData();
    refreshUser();
  };

  const openUpload = (type) => {
    setUploadType(type);
    setUploadOpen(true);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <Toaster position="top-right" richColors closeButton />

      <main className="mx-auto max-w-7xl px-4 sm:px-6 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Media Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Upload, process, and manage your videos and images.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={tab} onValueChange={setTab} className="space-y-4">
          <div className="flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="videos" className="gap-1.5">
                <FileVideo className="h-4 w-4" />
                Videos
                {videos.length > 0 && (
                  <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-xs">{videos.length}</span>
                )}
              </TabsTrigger>
              <TabsTrigger value="images" className="gap-1.5">
                <FileImage className="h-4 w-4" />
                Images
                {images.length > 0 && (
                  <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-xs">{images.length}</span>
                )}
              </TabsTrigger>
            </TabsList>

            <Button onClick={() => openUpload(tab === 'videos' ? 'video' : 'image')} size="sm">
              <Plus className="h-4 w-4 mr-1.5" />
              Upload {tab === 'videos' ? 'Video' : 'Image'}
            </Button>
          </div>

          <TabsContent value="videos" className="mt-0">
            <MediaGrid
              items={videos}
              type="video"
              jobs={jobs}
              onAction={handleOperation}
              getId={(item) => item.videoId || item.video_id}
              getThumbnailUrl={(item) => {
                const vid = item.videoId || item.video_id;
                return api.getVideoAssetUrl(vid, 'thumbnail');
              }}
              getAssetUrl={(item) => {
                const vid = item.videoId || item.video_id;
                return api.getVideoAssetUrl(vid, 'original');
              }}
            />
          </TabsContent>

          <TabsContent value="images" className="mt-0">
            <MediaGrid
              items={images}
              type="image"
              jobs={jobs}
              onAction={handleOperation}
              getId={(item) => item.image_id || item.imageId}
              getThumbnailUrl={(item) => {
                const iid = item.image_id || item.imageId;
                return api.getImageAssetUrl(iid, 'original');
              }}
              getAssetUrl={(item) => {
                const iid = item.image_id || item.imageId;
                return api.getImageAssetUrl(iid, 'original');
              }}
            />
          </TabsContent>
        </Tabs>
      </main>

      {/* Modals */}
      <UploadModal
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        type={uploadType}
        onUpload={handleUpload}
      />
      <OperationModal
        open={opOpen}
        onOpenChange={setOpOpen}
        operation={opType}
        onSubmit={handleOperationSubmit}
      />
      <CropModal
        open={cropOpen}
        onOpenChange={setCropOpen}
        imageUrl={cropTarget ? api.getImageAssetUrl(cropTarget.image_id || cropTarget.imageId, 'original') : ''}
        imageDimensions={cropTarget?.dimensions}
        onSubmit={handleCropSubmit}
      />
    </div>
  );
}
