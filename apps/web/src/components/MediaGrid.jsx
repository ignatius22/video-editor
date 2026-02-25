import MediaCard from './MediaCard';
import { FileVideo, FileImage } from 'lucide-react';

export default function MediaGrid({ items, type, jobs, onAction, getId, getThumbnailUrl, getAssetUrl }) {
  if (!items || items.length === 0) {
    const Icon = type === 'video' ? FileVideo : FileImage;
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted mb-4">
          <Icon className="h-8 w-8 text-muted-foreground/50" />
        </div>
        <h3 className="text-lg font-medium">No {type}s yet</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Upload your first {type} to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {items.map((item, index) => {
        const id = getId(item);
        return (
          <div 
            key={id} 
            className="animate-in-slide-up" 
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <MediaCard
              item={item}
              type={type}
              job={jobs[id]}
              thumbnailUrl={getThumbnailUrl(item)}
              assetUrl={getAssetUrl(item)}
              onAction={(op) => onAction(op, item)}
            />
          </div>
        );
      })}
    </div>
  );
}
