import { useState, useRef, useCallback, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Crop, RotateCcw } from 'lucide-react';

export default function CropModal({ open, onOpenChange, imageUrl, imageDimensions, onSubmit }) {
  const containerRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [resizing, setResizing] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [imageLoaded, setImageLoaded] = useState(false);
  const [displaySize, setDisplaySize] = useState({ width: 0, height: 0 });

  // Crop region in percentage (0-100) of displayed image
  const [crop, setCrop] = useState({ x: 25, y: 25, width: 50, height: 50 });

  // Reset crop when modal opens
  useEffect(() => {
    if (open) {
      setCrop({ x: 25, y: 25, width: 50, height: 50 });
      setError('');
      setImageLoaded(false);
    }
  }, [open]);

  const handleImageLoad = (e) => {
    setImageLoaded(true);
    setDisplaySize({ width: e.target.naturalWidth, height: e.target.naturalHeight });
  };

  // Convert percentage crop to actual pixel values
  const getCropPixels = useCallback(() => {
    if (!imageDimensions) return null;
    const { width: iw, height: ih } = imageDimensions;
    return {
      x: Math.round((crop.x / 100) * iw),
      y: Math.round((crop.y / 100) * ih),
      width: Math.round((crop.width / 100) * iw),
      height: Math.round((crop.height / 100) * ih),
    };
  }, [crop, imageDimensions]);

  const getRelativePos = useCallback((e) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.querySelector('img')?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    };
  }, []);

  const clamp = (val, min, max) => Math.max(min, Math.min(max, val));

  const handleMouseDown = useCallback((e, action) => {
    e.preventDefault();
    e.stopPropagation();
    const pos = getRelativePos(e);
    setDragStart({ x: pos.x - crop.x, y: pos.y - crop.y, cropSnapshot: { ...crop } });
    if (action === 'move') setDragging(true);
    if (action === 'resize') setResizing(true);
  }, [crop, getRelativePos]);

  const handleMouseMove = useCallback((e) => {
    if (!dragging && !resizing) return;
    const pos = getRelativePos(e);

    if (dragging) {
      const newX = clamp(pos.x - dragStart.x, 0, 100 - crop.width);
      const newY = clamp(pos.y - dragStart.y, 0, 100 - crop.height);
      setCrop(prev => ({ ...prev, x: newX, y: newY }));
    }

    if (resizing) {
      const newW = clamp(pos.x - crop.x, 5, 100 - crop.x);
      const newH = clamp(pos.y - crop.y, 5, 100 - crop.y);
      setCrop(prev => ({ ...prev, width: newW, height: newH }));
    }
  }, [dragging, resizing, dragStart, crop, getRelativePos]);

  const handleMouseUp = useCallback(() => {
    setDragging(false);
    setResizing(false);
  }, []);

  useEffect(() => {
    if (dragging || resizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [dragging, resizing, handleMouseMove, handleMouseUp]);

  const handleReset = () => {
    setCrop({ x: 25, y: 25, width: 50, height: 50 });
  };

  const handleSubmit = async () => {
    const pixels = getCropPixels();
    if (!pixels || pixels.width < 1 || pixels.height < 1) {
      setError('Invalid crop area');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await onSubmit(pixels);
      onOpenChange(false);
    } catch (err) {
      setError(err.message || 'Crop failed');
    } finally {
      setLoading(false);
    }
  };

  const pixels = getCropPixels();

  return (
    <Dialog open={open} onOpenChange={(v) => !loading && onOpenChange(v)}>
      <DialogContent className="sm:max-w-3xl glass border-none shadow-3xl p-0 overflow-hidden rounded-3xl">
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-primary via-primary/50 to-transparent" />
        
        <DialogHeader className="p-8 pb-4">
          <DialogTitle className="text-3xl font-black tracking-tighter uppercase italic text-foreground flex items-center gap-3">
            <Crop className="h-7 w-7 text-primary" />
            Precision <span className="text-primary">Crop</span>
          </DialogTitle>
          <DialogDescription className="text-[13px] font-medium text-muted-foreground uppercase tracking-widest opacity-60">
            Define the target sector for asset spatial refinement.
          </DialogDescription>
        </DialogHeader>

        <div className="px-8 pb-8 space-y-8">
          {error && (
            <div className="rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-3 text-[11px] font-bold text-destructive uppercase tracking-widest animate-in-fade">
              {error}
            </div>
          )}

          {/* Image with crop overlay */}
          <div
            ref={containerRef}
            className="relative select-none overflow-hidden rounded-2xl bg-muted/30 border border-border/50 shadow-inner group/crop"
            style={{ cursor: dragging ? 'grabbing' : 'default' }}
          >
            <img
              src={imageUrl}
              alt="Crop preview"
              className="w-full h-auto block transition-all duration-700 group-hover/crop:scale-[1.01]"
              draggable={false}
              onLoad={handleImageLoad}
              style={{ maxHeight: '55vh', objectFit: 'contain' }}
            />

            {imageLoaded && (
              <>
                {/* Dark overlay outside crop area */}
                <div
                  className="absolute inset-0 pointer-events-none transition-opacity duration-500"
                  style={{
                    background: `linear-gradient(to right,
                      rgba(0,0,0,0.65) ${crop.x}%,
                      transparent ${crop.x}%,
                      transparent ${crop.x + crop.width}%,
                      rgba(0,0,0,0.65) ${crop.x + crop.width}%)`,
                  }}
                />
                <div
                  className="absolute pointer-events-none"
                  style={{
                    left: `${crop.x}%`,
                    top: 0,
                    width: `${crop.width}%`,
                    height: `${crop.y}%`,
                    background: 'rgba(0,0,0,0.65)',
                  }}
                />
                <div
                  className="absolute pointer-events-none"
                  style={{
                    left: `${crop.x}%`,
                    top: `${crop.y + crop.height}%`,
                    width: `${crop.width}%`,
                    bottom: 0,
                    background: 'rgba(0,0,0,0.65)',
                  }}
                />

                {/* Crop selection area */}
                <div
                  className="absolute border-2 border-white/90 shadow-2xl animate-in-fade"
                  style={{
                    left: `${crop.x}%`,
                    top: `${crop.y}%`,
                    width: `${crop.width}%`,
                    height: `${crop.height}%`,
                    cursor: dragging ? 'grabbing' : 'grab',
                    boxShadow: '0 0 0 1px rgba(0,0,0,0.3), 0 0 40px rgba(0,0,0,0.5)',
                  }}
                  onMouseDown={(e) => handleMouseDown(e, 'move')}
                >
                  {/* Grid lines (rule of thirds) */}
                  <div className="absolute inset-0 pointer-events-none opacity-40">
                    <div className="absolute left-1/3 top-0 bottom-0 w-[1px] bg-white/50" />
                    <div className="absolute left-2/3 top-0 bottom-0 w-[1px] bg-white/50" />
                    <div className="absolute top-1/3 left-0 right-0 h-[1px] bg-white/50" />
                    <div className="absolute top-2/3 left-0 right-0 h-[1px] bg-white/50" />
                  </div>

                  {/* Corner handles */}
                  <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-white drop-shadow-lg" />
                  <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-white drop-shadow-lg" />
                  <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-white drop-shadow-lg" />

                  {/* Resize handle (bottom-right corner) */}
                  <div
                    className="absolute -bottom-2 -right-2 w-6 h-6 border-b-2 border-r-2 border-white bg-white/10 rounded-br-md backdrop-blur-sm"
                    style={{ cursor: 'nwse-resize' }}
                    onMouseDown={(e) => handleMouseDown(e, 'resize')}
                  />
                </div>
              </>
            )}
          </div>

          {/* Crop dimensions info */}
          <div className="grid grid-cols-2 gap-6 p-6 bg-muted/30 rounded-2xl border border-border/50">
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">Selection Metrics</p>
              <p className="text-lg font-black text-foreground tracking-tighter">
                {pixels?.width} <span className="text-primary/50 mx-1">×</span> {pixels?.height} <span className="text-[11px] font-bold text-muted-foreground ml-1">PX</span>
              </p>
            </div>
            <div className="space-y-1 text-right">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">Source Resolution</p>
              <p className="text-lg font-black text-foreground tracking-tighter opacity-80">
                {imageDimensions?.width} <span className="text-primary/50 mx-1">×</span> {imageDimensions?.height} <span className="text-[11px] font-bold text-muted-foreground ml-1">PX</span>
              </p>
            </div>
          </div>

          <div className="flex justify-between items-center pt-2">
            <Button 
              variant="outline" 
              type="button" 
              onClick={handleReset} 
              disabled={loading}
              className="rounded-xl h-12 px-6 font-black uppercase tracking-widest text-[11px] border-border/50 hover:bg-muted"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset Matrix
            </Button>
            
            <div className="flex gap-3">
              <Button 
                variant="outline" 
                type="button" 
                onClick={() => onOpenChange(false)} 
                disabled={loading}
                className="rounded-xl h-12 px-6 font-black uppercase tracking-widest text-[11px] border-border/50 hover:bg-muted"
              >
                Abort
              </Button>
              <Button 
                onClick={handleSubmit} 
                disabled={loading || !imageLoaded}
                className="rounded-xl h-12 px-8 font-black uppercase tracking-widest text-[12px] shadow-xl shadow-primary/20 bg-primary hover:bg-primary/90 transition-all active:scale-95"
              >
                {loading ? 'Processing...' : 'Execute Crop'}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
