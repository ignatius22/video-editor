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
} from 'lucide-react';

export default function MediaCard({ item, type, job, onAction, thumbnailUrl, assetUrl }) {
  const isVideo = type === 'video';
  const Icon = isVideo ? FileVideo : FileImage;
  const status = item.status || 'ready';
  const isProcessing = job && (job.event === 'queued' || job.event === 'started' || job.event === 'progress');
  const progress = job?.progress || 0;

  const statusColor = {
    ready: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    processing: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    completed: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    failed: 'bg-destructive/10 text-destructive border-destructive/20',
    queued: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  };

  const displayStatus = isProcessing ? job.event : status;

  return (
    <Card className="group overflow-hidden border-border/50 bg-card/50 backdrop-blur transition-all hover:border-border hover:shadow-lg">
      {/* Thumbnail / Preview */}
      <div className="relative aspect-video bg-muted/50 flex items-center justify-center overflow-hidden">
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={item.originalName || item.name || item.filename}
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
            loading="lazy"
            onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling && (e.target.nextSibling.style.display = 'flex'); }}
          />
        ) : null}
        {!thumbnailUrl && (
          <Icon className="h-12 w-12 text-muted-foreground/40" />
        )}

        {/* Status Badge */}
        <div className="absolute top-2 right-2">
          <Badge variant="outline" className={`text-xs ${statusColor[displayStatus] || statusColor.ready}`}>
            {displayStatus}
          </Badge>
        </div>
      </div>

      <CardContent className="p-4 space-y-3">
        {/* Title */}
        <div className="min-w-0">
          <p className="text-sm font-medium truncate" title={item.originalName || item.filename}>
            {item.originalName || item.filename}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {item.dimensions
              ? `${item.dimensions.width}×${item.dimensions.height}`
              : item.format?.toUpperCase() || 'Unknown'}
            {item.size && ` · ${(item.size / (1024 * 1024)).toFixed(1)} MB`}
          </p>
        </div>

        {/* Progress bar */}
        {isProcessing && (
          <div className="space-y-1">
            <Progress value={progress} className="h-1.5" />
            <p className="text-xs text-muted-foreground">{Math.round(progress)}% complete</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-xs"
            onClick={() => window.open(assetUrl, '_blank')}
            disabled={!assetUrl}
          >
            <Download className="h-3.5 w-3.5 mr-1" />
            Download
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="h-8 w-8 shrink-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={() => onAction(isVideo ? 'resizeVideo' : 'resizeImage')}>
                <Maximize className="h-4 w-4 mr-2" />
                Resize
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onAction(isVideo ? 'convertVideo' : 'convertImage')}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Convert
              </DropdownMenuItem>
              {isVideo && (
                <DropdownMenuItem onClick={() => onAction('extractAudio')}>
                  <Music className="h-4 w-4 mr-2" />
                  Extract Audio
                </DropdownMenuItem>
              )}
              {!isVideo && (
                <DropdownMenuItem onClick={() => onAction('cropImage')}>
                  <Scissors className="h-4 w-4 mr-2" />
                  Crop
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => window.open(assetUrl, '_blank')}>
                <Download className="h-4 w-4 mr-2" />
                Download Original
              </DropdownMenuItem>
              {/* Converted format downloads */}
              {item.conversions && Object.entries(item.conversions)
                .map(([fmt, v]) => (
                  <DropdownMenuItem 
                    key={`conv-${fmt}`} 
                    disabled={!v.completed && v.status !== 'completed'}
                    onClick={() => {
                      const url = isVideo
                        ? `/api/videos/asset?videoId=${item.videoId || item.video_id}&type=converted&format=${fmt}`
                        : `/api/images/asset?imageId=${item.image_id || item.imageId}&type=converted&format=${fmt}`;
                      window.open(url, '_blank');
                    }}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    {v.completed || v.status === 'completed' 
                      ? `Download ${fmt.toUpperCase()}`
                      : `Converting to ${fmt.toUpperCase()}...`}
                  </DropdownMenuItem>
                ))
              }
              {/* Resized downloads */}
              {item.resizes && Object.entries(item.resizes)
                .map(([dim, v]) => (
                  <DropdownMenuItem 
                    key={`resize-${dim}`} 
                    disabled={!v.completed && v.status !== 'completed'}
                    onClick={() => {
                      const url = isVideo
                        ? `/api/videos/asset?videoId=${item.videoId || item.video_id}&type=resize&dimensions=${dim}`
                        : `/api/images/asset?imageId=${item.image_id || item.imageId}&type=resized&dimensions=${dim}`;
                      window.open(url, '_blank');
                    }}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    {v.completed || v.status === 'completed' 
                      ? `Download ${dim}`
                      : `Resizing to ${dim}...`}
                  </DropdownMenuItem>
                ))
              }
              {/* Cropped downloads */}
              {!isVideo && item.crops && Object.entries(item.crops)
                .map(([dim, v]) => (
                  <DropdownMenuItem 
                    key={`crop-${dim}`} 
                    disabled={!v.completed && v.status !== 'completed'}
                    onClick={() => {
                      const url = `/api/images/asset?imageId=${item.image_id || item.imageId}&type=cropped&dimensions=${dim}`;
                      window.open(url, '_blank');
                    }}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    {v.completed || v.status === 'completed' 
                      ? `Download Crop ${dim.replace(/x/g, ' × ')}`
                      : `Cropping ${dim.replace(/x/g, ' × ')}...`}
                  </DropdownMenuItem>
                ))
              }
              {/* Extracted audio download */}
              {isVideo && item.extractedAudio && (
                <DropdownMenuItem onClick={() => {
                  window.open(`/api/videos/asset?videoId=${item.videoId || item.video_id}&type=audio`, '_blank');
                }}>
                  <Music className="h-4 w-4 mr-2" />
                  Download Audio
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
}
