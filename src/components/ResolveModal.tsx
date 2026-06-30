import React, { useState, useRef } from 'react';
import { X, Camera, Upload, CheckCircle } from 'lucide-react';
import { Issue } from '../types';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import clsx from 'clsx';
import { toast } from 'react-toastify';

interface ResolveModalProps {
  issue: Issue;
  onClose: () => void;
  addPoints: (points: number) => void;
}

export default function ResolveModal({ issue, onClose, addPoints }: ResolveModalProps) {
  const [photoData, setPhotoData] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoData(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleResolve = async () => {
    if (!photoData) {
      toast.error("Please provide an after-photo to resolve this issue.");
      return;
    }
    setIsSubmitting(true);
    try {
      await updateDoc(doc(db, 'issues', issue.id), {
        status: 'Resolved',
        afterPhoto: photoData
      });
      addPoints(50);
      toast.success("Issue resolved! Thank you for fixing this. +50 pts");
      onClose();
    } catch (e) {
      toast.error("Failed to resolve.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-4 border-b flex justify-between items-center bg-emerald-50">
          <h2 className="text-lg font-bold text-emerald-800 flex items-center gap-2">
            <CheckCircle size={20} /> Resolve Issue
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-emerald-100 rounded-full transition-colors text-emerald-700">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 overflow-y-auto flex-1">
          <p className="text-sm text-slate-600 mb-4">
            You are about to mark this issue as resolved. Please provide an "after" photo to verify the fix.
          </p>

          <div className="mb-4 bg-slate-50 p-3 rounded-lg border border-slate-200">
            <div className="text-xs font-bold text-slate-500 uppercase">Issue</div>
            <div className="font-semibold text-slate-800">{issue.category} at {issue.areaName}</div>
          </div>

          <div className="space-y-3">
            <label className="block text-sm font-semibold text-slate-700">After Photo Proof</label>
            {!photoData ? (
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 rounded-lg p-8 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-slate-50 transition-colors"
              >
                <div className="flex gap-4">
                  <div className="bg-emerald-100 p-3 rounded-full text-emerald-600">
                    <Camera size={24} />
                  </div>
                </div>
                <div className="text-sm font-medium text-slate-600 mt-2">Take Photo or Upload</div>
                <input 
                  type="file" 
                  accept="image/*" 
                  capture="environment" 
                  className="hidden" 
                  ref={fileInputRef}
                  onChange={handlePhotoCapture}
                />
              </div>
            ) : (
              <div className="relative rounded-lg overflow-hidden border border-slate-200">
                <img src={photoData} alt="Proof" className="w-full h-48 object-cover" />
                <button 
                  onClick={() => setPhotoData(null)}
                  className="absolute top-2 right-2 bg-slate-900/70 text-white p-1.5 rounded-full hover:bg-slate-900"
                >
                  <X size={16} />
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="p-4 border-t bg-slate-50 flex justify-end gap-2">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleResolve}
            disabled={!photoData || isSubmitting}
            className="px-4 py-2 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-2"
          >
            {isSubmitting ? "Submitting..." : "Submit Resolution"}
          </button>
        </div>
      </div>
    </div>
  );
}
