import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const OPERATIONS = {
  resizeVideo: {
    title: 'Resize Video',
    description: 'Set new dimensions for the video.',
    fields: [
      { name: 'width', label: 'Width', type: 'number', placeholder: '1920' },
      { name: 'height', label: 'Height', type: 'number', placeholder: '1080' },
    ],
  },
  convertVideo: {
    title: 'Convert Video',
    description: 'Convert to a different video format.',
    fields: [
      { name: 'format', label: 'Format', type: 'select', options: ['mp4', 'webm', 'avi', 'mkv', 'mov'] },
    ],
  },
  extractAudio: {
    title: 'Extract Audio',
    description: 'Extract the audio track from this video.',
    fields: [
      { name: 'format', label: 'Format', type: 'select', options: ['mp3', 'wav', 'aac', 'ogg'] },
    ],
  },
  resizeImage: {
    title: 'Resize Image',
    description: 'Set new dimensions for the image.',
    fields: [
      { name: 'width', label: 'Width', type: 'number', placeholder: '1920' },
      { name: 'height', label: 'Height', type: 'number', placeholder: '1080' },
    ],
  },
  convertImage: {
    title: 'Convert Image',
    description: 'Convert to a different image format.',
    fields: [
      { name: 'format', label: 'Format', type: 'select', options: ['png', 'jpeg', 'webp', 'gif', 'bmp'] },
    ],
  },
  cropImage: {
    title: 'Crop Image',
    description: 'Crop a region from the image.',
    fields: [
      { name: 'width', label: 'Width', type: 'number', placeholder: '800' },
      { name: 'height', label: 'Height', type: 'number', placeholder: '600' },
      { name: 'x', label: 'X Offset', type: 'number', placeholder: '0' },
      { name: 'y', label: 'Y Offset', type: 'number', placeholder: '0' },
    ],
  },
};

export default function OperationModal({ open, onOpenChange, operation, onSubmit }) {
  const [values, setValues] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const config = OPERATIONS[operation];
  if (!config) return null;

  const handleChange = (name, value) => {
    setValues(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await onSubmit(values);
      setValues({});
      onOpenChange(false);
    } catch (err) {
      setError(err.message || 'Operation failed');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = (open) => {
    if (!loading) {
      setValues({});
      setError('');
      onOpenChange(open);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg glass border-none shadow-3xl p-0 overflow-hidden rounded-3xl">
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-primary via-primary/50 to-transparent" />
        
        <DialogHeader className="p-8 pb-4">
          <DialogTitle className="text-3xl font-black tracking-tighter uppercase italic text-foreground">
            Execute <span className="text-primary">Operation</span>
          </DialogTitle>
          <DialogDescription className="text-[13px] font-medium text-muted-foreground uppercase tracking-widest opacity-60">
            {config.title} — {config.description}
          </DialogDescription>
        </DialogHeader>

        <div className="px-8 pb-8">
          {error && (
            <div className="mb-6 rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-3 text-[11px] font-bold text-destructive uppercase tracking-widest animate-in-fade">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-5">
              {config.fields.map((field) => (
                <div key={field.name} className="space-y-2">
                  <Label htmlFor={field.name} className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
                    {field.label}
                  </Label>
                  {field.type === 'select' ? (
                    <Select value={values[field.name] || ''} onValueChange={(v) => handleChange(field.name, v)}>
                      <SelectTrigger className="rounded-xl bg-muted/50 border-border/50 focus:ring-primary/20 h-11 px-4 font-bold border-none shadow-inner">
                        <SelectValue placeholder={`Select ${field.label.toLowerCase()}`} />
                      </SelectTrigger>
                      <SelectContent className="glass border-border/50 rounded-xl">
                        {field.options.map((opt) => (
                          <SelectItem key={opt} value={opt} className="text-[11px] font-black uppercase tracking-widest focus:bg-primary/10 transition-colors">
                            {opt}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      id={field.name}
                      type={field.type}
                      placeholder={field.placeholder}
                      className="rounded-xl bg-muted/50 border-border/50 focus:border-primary/50 focus:ring-primary/20 h-11 px-4 font-bold border-none shadow-inner"
                      value={values[field.name] || ''}
                      onChange={(e) => handleChange(field.name, e.target.value)}
                      required
                      min={field.type === 'number' ? 1 : undefined}
                    />
                  )}
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button 
                variant="outline" 
                type="button" 
                onClick={() => handleClose(false)} 
                disabled={loading}
                className="rounded-xl h-11 px-6 font-black uppercase tracking-widest text-[11px] border-border/50 hover:bg-muted"
              >
                Abort
              </Button>
              <Button 
                type="submit" 
                disabled={loading}
                className="rounded-xl h-11 px-8 font-black uppercase tracking-widest text-[11px] shadow-xl shadow-primary/20 bg-primary hover:bg-primary/90 transition-all active:scale-95"
              >
                {loading ? 'Processing...' : 'Initialize'}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
