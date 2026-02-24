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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{config.title}</DialogTitle>
          <DialogDescription>{config.description}</DialogDescription>
        </DialogHeader>

        {error && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {config.fields.map((field) => (
            <div key={field.name} className="space-y-2">
              <Label htmlFor={field.name}>{field.label}</Label>
              {field.type === 'select' ? (
                <Select value={values[field.name] || ''} onValueChange={(v) => handleChange(field.name, v)}>
                  <SelectTrigger>
                    <SelectValue placeholder={`Select ${field.label.toLowerCase()}`} />
                  </SelectTrigger>
                  <SelectContent>
                    {field.options.map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {opt.toUpperCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  id={field.name}
                  type={field.type}
                  placeholder={field.placeholder}
                  value={values[field.name] || ''}
                  onChange={(e) => handleChange(field.name, e.target.value)}
                  required
                  min={field.type === 'number' ? 1 : undefined}
                />
              )}
            </div>
          ))}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" type="button" onClick={() => handleClose(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Processing…' : 'Start'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
