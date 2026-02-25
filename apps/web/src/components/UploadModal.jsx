import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Upload, FileVideo, FileImage, X } from 'lucide-react';

export default function UploadModal({ open, onOpenChange, type, onUpload }) {
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  const accept = type === 'video'
    ? 'video/mp4,video/webm,video/quicktime,video/x-msvideo,video/x-matroska'
    : 'image/jpeg,image/png,image/gif,image/webp,image/bmp,image/tiff';

  const Icon = type === 'video' ? FileVideo : FileImage;

  const reset = () => {
    setFile(null);
    setError('');
    setUploading(false);
  };

  const handleClose = (open) => {
    if (!uploading) {
      reset();
      onOpenChange(open);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) setFile(dropped);
  };

  const handleSubmit = async () => {
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      await onUpload(file);
      reset();
      onOpenChange(false);
    } catch (err) {
      setError(err.message || 'Upload failed');
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg glass border-none shadow-3xl p-0 overflow-hidden rounded-3xl">
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-primary via-primary/50 to-transparent" />
        
        <DialogHeader className="p-8 pb-4">
          <DialogTitle className="text-3xl font-black tracking-tighter uppercase italic text-foreground">
            Ingest <span className="text-primary">{type}</span>
          </DialogTitle>
          <DialogDescription className="text-[13px] font-medium text-muted-foreground uppercase tracking-widest opacity-60">
            Initialize asset integration into the processing matrix.
          </DialogDescription>
        </DialogHeader>

        <div className="px-8 pb-8 space-y-6">
          {error && (
            <div className="rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-3 text-[11px] font-bold text-destructive uppercase tracking-widest animate-in-fade">
              {error}
            </div>
          )}

          {!file ? (
            <div
              className={`relative flex flex-col items-center justify-center rounded-3xl border-2 border-dashed p-12 transition-all cursor-pointer group/upload ${
                dragging
                  ? 'border-primary bg-primary/10 shadow-inner'
                  : 'border-border/50 hover:border-primary/50 hover:bg-muted/30'
              }`}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/50 mb-6 group-hover/upload:scale-110 group-hover/upload:bg-primary/10 group-hover/upload:text-primary transition-all duration-500 shadow-sm">
                <Upload className="h-7 w-7 transition-transform group-hover/upload:-translate-y-1" />
              </div>
              <p className="text-lg font-black text-foreground tracking-tight group-hover/upload:text-primary transition-colors">Drop {type} Matrix</p>
              <p className="text-[11px] font-bold text-muted-foreground mt-2 uppercase tracking-widest opacity-60">or click to browse local sectors</p>
              <input
                ref={inputRef}
                type="file"
                accept={accept}
                className="hidden"
                onChange={(e) => setFile(e.target.files[0])}
              />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-5 rounded-3xl border border-primary/20 bg-primary/5 p-6 animate-in-slide-up shadow-sm">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
                  <Icon className="h-6 w-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-foreground truncate uppercase tracking-tight">{file.name}</p>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-60">
                    {(file.size / (1024 * 1024)).toFixed(2)} MB • Local Cache Ready
                  </p>
                </div>
                {!uploading && (
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => setFile(null)}
                    className="rounded-xl hover:bg-destructive/10 hover:text-destructive transition-colors h-10 w-10"
                  >
                    <X className="h-5 w-5" />
                  </Button>
                )}
              </div>

              {uploading && (
                <div className="space-y-3 px-1">
                  <div className="flex justify-between text-[10px] font-black uppercase tracking-[0.2em] text-primary">
                    <span className="animate-pulse">Dispatching to Processing Pipeline...</span>
                    <span>Encrypting</span>
                  </div>
                  <Progress className="h-1.5 bg-primary/10" value={undefined} />
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button 
              variant="outline" 
              onClick={() => handleClose(false)} 
              disabled={uploading}
              className="rounded-xl h-12 px-6 font-black uppercase tracking-widest text-[11px] border-border/50 hover:bg-muted"
            >
              Abort
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={!file || uploading}
              className="rounded-xl h-12 px-8 font-black uppercase tracking-widest text-[12px] shadow-xl shadow-primary/20 bg-primary hover:bg-primary/90 transition-all active:scale-95"
            >
              {uploading ? 'Initializing...' : 'Confirm Upload'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
