import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Progress } from '@/components/ui/progress';
import {
  MoreVertical,
  Download,
  Maximize,
  RefreshCw,
  Scissors,
  Music,
  FileVideo,
  FileImage,
  Clock,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

export default function MediaCard({ item, type, job, onAction, thumbnailUrl, assetUrl }) {
  const isVideo = type === 'video';
  const Icon = isVideo ? FileVideo : FileImage;
  const status = item.status || 'ready';
  const isProcessing = job && (job.event === 'queued' || job.event === 'started' || job.event === 'progress');
  const progress = job?.progress || 0;

  const statusConfigs = {
    ready: { color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20', icon: CheckCircle2 },
    processing: { color: 'bg-primary/10 text-primary border-primary/20', icon: RefreshCw, spin: true },
    completed: { color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20', icon: CheckCircle2 },
    failed: { color: 'bg-destructive/10 text-destructive border-destructive/20', icon: AlertCircle },
    queued: { color: 'bg-blue-500/10 text-blue-500 border-blue-500/20', icon: Clock },
  };

  const displayStatus = isProcessing ? job.event : status;
  const config = statusConfigs[displayStatus] || statusConfigs.ready;
  const StatusIcon = config.icon;

  return (
    <Card className="glass-card group overflow-hidden transition-all duration-300 hover:shadow-2xl hover:shadow-primary/10 hover:-translate-y-1">
      {/* Thumbnail / Preview */}
      <div className="relative aspect-video bg-muted flex items-center justify-center overflow-hidden">
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={item.originalName || item.name || item.filename}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
            loading="lazy"
            onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling && (e.target.nextSibling.style.display = 'flex'); }}
          />
        ) : null}
        {!thumbnailUrl && (
          <Icon className="h-12 w-12 text-muted-foreground/30" />
        )}

        {/* Overlay on hover */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center gap-2">
           <Button 
            size="sm" 
            variant="secondary" 
            className="rounded-full shadow-xl translate-y-2 group-hover:translate-y-0 transition-transform duration-300"
            onClick={() => window.open(assetUrl, '_blank')}
            disabled={!assetUrl}
           >
             <Maximize className="w-4 h-4 mr-1" />
             View
           </Button>
        </div>

        {/* Status Badge */}
        <div className="absolute top-3 left-3">
          <Badge variant="outline" className={`px-2 py-0.5 backdrop-blur-md flex items-center gap-1.5 border capitalize font-semibold tracking-wide ${config.color}`}>
            <StatusIcon className={`w-3 h-3 ${config.spin ? 'animate-spin' : ''}`} />
            {displayStatus}
          </Badge>
        </div>
      </div>

      <CardContent className="p-5 space-y-4">
        {/* Title & Meta */}
        <div className="space-y-1">
          <p className="font-bold truncate tracking-tight text-foreground" title={item.originalName || item.filename}>
            {item.originalName || item.filename}
          </p>
          <div className="flex items-center gap-2 text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
            <span>
              {item.dimensions
                ? `${item.dimensions.width}×${item.dimensions.height}`
                : item.format?.toUpperCase() || 'Unknown'}
            </span>
            <span className="w-1 h-1 bg-muted-foreground/30 rounded-full" />
            <span>{item.size ? `${(item.size / (1024 * 1024)).toFixed(1)} MB` : 'N/A'}</span>
          </div>
        </div>

        {/* Progress bar */}
        {isProcessing && (
          <div className="space-y-2">
            <div className="flex justify-between text-[11px] font-bold uppercase tracking-widest text-primary">
              <span>Processing...</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-1.5 bg-primary/10" />
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 font-bold text-[11px] uppercase tracking-widest bg-muted/30 border-border/50 hover:bg-muted hover:border-primary/30 transition-all rounded-lg"
            onClick={() => window.open(assetUrl, '_blank')}
            disabled={!assetUrl}
          >
            <Download className="h-3.5 w-3.5 mr-2 text-primary" />
            Download
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="h-9 w-9 shrink-0 bg-muted/30 border-border/50 rounded-lg hover:border-primary/30 transition-all">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 glass p-1.5 rounded-xl border-border/50 shadow-2xl">
              <DropdownMenuItem onClick={() => onAction(isVideo ? 'resizeVideo' : 'resizeImage')} className="rounded-lg focus:bg-primary/10 focus:text-primary py-2.5">
                <Maximize className="h-4 w-4 mr-2" />
                <span className="font-medium">Resize {isVideo ? 'Video' : 'Image'}</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onAction(isVideo ? 'convertVideo' : 'convertImage')} className="rounded-lg focus:bg-primary/10 focus:text-primary py-2.5">
                <RefreshCw className="h-4 w-4 mr-2" />
                <span className="font-medium">Change Format</span>
              </DropdownMenuItem>
              {isVideo && (
                <DropdownMenuItem onClick={() => onAction('extractAudio')} className="rounded-lg focus:bg-primary/10 focus:text-primary py-2.5">
                  <Music className="h-4 w-4 mr-2" />
                  <span className="font-medium">Extract Audio</span>
                </DropdownMenuItem>
              )}
              {!isVideo && (
                <DropdownMenuItem onClick={() => onAction('cropImage')} className="rounded-lg focus:bg-primary/10 focus:text-primary py-2.5">
                  <Scissors className="h-4 w-4 mr-2" />
                  <span className="font-medium">Crop Selection</span>
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator className="bg-border/50 my-1.5" />
              <DropdownMenuItem onClick={() => window.open(assetUrl, '_blank')} className="rounded-lg py-2.5">
                <Download className="h-4 w-4 mr-2" />
                <span className="font-medium">Original Asset</span>
              </DropdownMenuItem>
              
              {/* Converted format downloads */}
              {item.conversions && Object.keys(item.conversions).length > 0 && (
                <>
                  <DropdownMenuSeparator className="bg-border/50 my-1.5" />
                  <div className="px-2 py-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Conversions</div>
                  {Object.entries(item.conversions).map(([fmt, v]) => (
                    <DropdownMenuItem 
                      key={`conv-${fmt}`} 
                      disabled={!v.completed && v.status !== 'completed'}
                      className="rounded-lg py-2.5"
                      onClick={() => {
                        const url = isVideo
                          ? `/api/videos/asset?videoId=${item.videoId || item.video_id}&type=converted&format=${fmt}`
                          : `/api/images/asset?imageId=${item.image_id || item.imageId}&type=converted&format=${fmt}`;
                        window.open(url, '_blank');
                      }}
                    >
                      <Download className="h-4 w-4 mr-2 opacity-50" />
                      <span className="font-medium">{fmt.toUpperCase()} {(!v.completed && v.status !== 'completed') ? '(Pending)' : ''}</span>
                    </DropdownMenuItem>
                  ))}
                </>
              )}

              {/* Resized downloads */}
              {item.resizes && Object.keys(item.resizes).length > 0 && (
                <>
                  <DropdownMenuSeparator className="bg-border/50 my-1.5" />
                  <div className="px-2 py-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Resized</div>
                  {Object.entries(item.resizes).map(([dim, v]) => (
                    <DropdownMenuItem 
                      key={`resize-${dim}`} 
                      disabled={!v.completed && v.status !== 'completed'}
                      className="rounded-lg py-2.5"
                      onClick={() => {
                        const url = isVideo
                          ? `/api/videos/asset?videoId=${item.videoId || item.video_id}&type=resize&dimensions=${dim}`
                          : `/api/images/asset?imageId=${item.image_id || item.imageId}&type=resized&dimensions=${dim}`;
                        window.open(url, '_blank');
                      }}
                    >
                      <Download className="h-4 w-4 mr-2 opacity-50" />
                      <span className="font-medium">{dim} {(!v.completed && v.status !== 'completed') ? '(Pending)' : ''}</span>
                    </DropdownMenuItem>
                  ))}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
}
