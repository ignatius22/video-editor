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

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 space-y-10">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 animate-in-fade">
          <div className="space-y-1">
            <h1 className="text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl uppercase">
              Media <span className="text-primary italic">Studio</span>
            </h1>
            <p className="text-base text-muted-foreground font-medium max-w-2xl">
              The all-in-one workstation to upload, transform, and manage your high-quality assets with precision.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={fetchData} 
              disabled={loading}
              className="rounded-xl border-border/50 hover:bg-muted font-bold uppercase tracking-widest text-[10px]"
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-2 ${loading ? 'animate-spin text-primary' : ''}`} />
              Sync Library
            </Button>
            <Button 
              onClick={() => openUpload(tab === 'videos' ? 'video' : 'image')} 
              size="sm"
              className="rounded-xl font-bold uppercase tracking-widest text-[10px] shadow-lg shadow-primary/20 transition-all hover:scale-105 active:scale-95 px-5 bg-primary hover:bg-primary/90"
            >
              <Plus className="h-4 w-4 mr-2" />
              Upload {tab === 'videos' ? 'Video' : 'Image'}
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={tab} onValueChange={setTab} className="space-y-6">
          <div className="flex items-center justify-between border-b border-border/50 pb-px">
            <TabsList className="bg-transparent h-auto p-0 gap-8">
              <TabsTrigger 
                value="videos" 
                className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary border-b-2 border-transparent data-[state=active]:border-primary rounded-none px-0 py-3 gap-2.5 font-bold transition-all text-muted-foreground hover:text-foreground"
              >
                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center group-data-[state=active]:bg-primary/10 transition-colors">
                  <FileVideo className="h-4.5 w-4.5" />
                </div>
                <div className="flex flex-col items-start leading-none">
                  <span className="text-sm">Video Library</span>
                  <span className="text-[10px] font-bold opacity-60 uppercase tracking-tighter mt-1">{videos.length} Assets</span>
                </div>
              </TabsTrigger>
              <TabsTrigger 
                value="images" 
                className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary border-b-2 border-transparent data-[state=active]:border-primary rounded-none px-0 py-3 gap-2.5 font-bold transition-all text-muted-foreground hover:text-foreground"
              >
                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center group-data-[state=active]:bg-primary/10 transition-colors">
                  <FileImage className="h-4.5 w-4.5" />
                </div>
                <div className="flex flex-col items-start leading-none">
                  <span className="text-sm">Image Gallery</span>
                  <span className="text-[10px] font-bold opacity-60 uppercase tracking-tighter mt-1">{images.length} Assets</span>
                </div>
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="videos" className="mt-0 outline-none">
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

          <TabsContent value="images" className="mt-0 outline-none">
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
