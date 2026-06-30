import React from 'react';
import { X, Award, MapPin, CheckCircle, AlertTriangle, LogIn, LogOut } from 'lucide-react';
import { Issue } from '../types';
import { User as FirebaseUser } from 'firebase/auth';

interface ProfileModalProps {
  points: number;
  issues: Issue[];
  onClose: () => void;
  user: FirebaseUser | null;
  onLogin: () => void;
  onLogout: () => void;
}

export default function ProfileModal({ points, issues, onClose, user, onLogin, onLogout }: ProfileModalProps) {
  const resolvedCount = issues.filter(i => i.status === 'Resolved').length;
  const escalatedCount = issues.filter(i => i.status === 'Escalated').length;
  
  // Calculate a mock rank based on points
  let rank = 'Observer';
  if (points >= 1000) rank = 'Civic Legend';
  else if (points >= 500) rank = 'Our Responsibility';
  else if (points >= 200) rank = 'Active Citizen';
  else if (points >= 50) rank = 'Neighborhood Watch';
  else if (points >= 10) rank = 'Good Samaritan';

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
        <div className="p-4 border-b flex justify-between items-center bg-slate-800 text-white">
          <h2 className="text-lg font-bold flex items-center gap-2">
            User Profile
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-full transition-colors text-slate-300">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 flex flex-col items-center gap-4 bg-slate-50">
          <div className="w-24 h-24 rounded-full bg-blue-100 flex items-center justify-center border-4 border-white shadow-sm mb-2 overflow-hidden">
            {user?.photoURL ? (
              <img src={user.photoURL} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <Award size={48} className="text-blue-500" />
            )}
          </div>
          
          <div className="text-center">
            <h3 className="text-2xl font-bold text-slate-800">{user?.displayName || rank}</h3>
            <p className="text-slate-500 font-medium">{user?.email || "Chennai Community Member"}</p>
          </div>

          {!user ? (
            <button 
              onClick={onLogin}
              className="mt-2 w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg font-bold transition-colors flex items-center justify-center gap-2"
            >
              <LogIn size={18} /> Sign In with Google
            </button>
          ) : (
            <button 
              onClick={onLogout}
              className="mt-2 w-full bg-slate-200 hover:bg-slate-300 text-slate-700 py-2.5 rounded-lg font-bold transition-colors flex items-center justify-center gap-2"
            >
              <LogOut size={18} /> Sign Out
            </button>
          )}

          <div className="grid grid-cols-2 gap-4 w-full mt-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 text-center shadow-sm">
              <div className="text-3xl font-bold text-emerald-500 mb-1">{points}</div>
              <div className="text-xs font-semibold text-slate-500 uppercase">Impact Points</div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 text-center shadow-sm">
              <div className="text-3xl font-bold text-blue-500 mb-1">{issues.length}</div>
              <div className="text-xs font-semibold text-slate-500 uppercase">Total Reports</div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 text-center shadow-sm">
              <div className="text-3xl font-bold text-orange-500 mb-1">{escalatedCount}</div>
              <div className="text-xs font-semibold text-slate-500 uppercase">Escalated</div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 text-center shadow-sm">
              <div className="text-3xl font-bold text-indigo-500 mb-1">{resolvedCount}</div>
              <div className="text-xs font-semibold text-slate-500 uppercase">Resolved</div>
            </div>
          </div>
          
          <div className="w-full mt-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <h4 className="font-semibold text-slate-800 mb-2 border-b pb-2">Recent Badges</h4>
            <div className="flex flex-wrap gap-2">
              <div className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1">
                <CheckCircle size={12} /> First Fix
              </div>
              {points >= 50 && (
                <div className="bg-purple-100 text-purple-800 text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1">
                  <Award size={12} /> Rising Star
                </div>
              )}
              {points >= 200 && (
                <div className="bg-orange-100 text-orange-800 text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1">
                  <AlertTriangle size={12} /> Watchful Eye
                </div>
              )}
              {issues.length >= 5 && (
                <div className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1">
                  <MapPin size={12} /> Local Guide
                </div>
              )}
              {resolvedCount >= 3 && (
                <div className="bg-teal-100 text-teal-800 text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1">
                  <CheckCircle size={12} /> Fixer Upper
                </div>
              )}
              {escalatedCount >= 1 && (
                <div className="bg-red-100 text-red-800 text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1">
                  <AlertTriangle size={12} /> Whistleblower
                </div>
              )}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
