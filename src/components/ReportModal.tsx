import { useState, useRef, useEffect } from 'react';
import { db, storage } from '../lib/firebase';
import { collection, addDoc, updateDoc, doc } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { Issue, Agent2Output, Agent3Output } from '../types';
import { calculateDistance, calculateImpactScore, calculateDurationScore } from '../utils/helpers';
import { toast } from 'react-toastify';
import { CheckCircle2, CircleDashed, Loader2, MapPin, Upload, X } from 'lucide-react';
import clsx from 'clsx';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import L from 'leaflet';

interface ReportModalProps {
  onClose: () => void;
  addPoints: (p: number) => void;
  existingIssues: Issue[];
}

type StepState = 'Waiting' | 'Running' | 'Done';

function DraggableMarker({ location, setLocation, setAreaName }: any) {
  const markerRef = useRef<L.Marker>(null);
  
  const handleDragEnd = () => {
    const marker = markerRef.current;
    if (marker != null) {
      const { lat, lng } = marker.getLatLng();
      setLocation({ lat, lng });
      fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=14`)
        .then(res => res.json())
        .then(data => {
           setAreaName(data.name || data.address?.suburb || data.address?.city_district || data.address?.city || "Selected Area");
        })
        .catch(() => setAreaName("Selected Area"));
    }
  };

  return location ? (
    <Marker
      draggable={true}
      eventHandlers={{ dragend: handleDragEnd }}
      position={[location.lat, location.lng]}
      ref={markerRef}
    />
  ) : null;
}

export default function ReportModal({ onClose, addPoints, existingIssues }: ReportModalProps) {
  const [photoData, setPhotoData] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  
  const [agent1State, setAgent1State] = useState<StepState>('Waiting');
  const [agent2State, setAgent2State] = useState<StepState>('Waiting');
  const [agent3State, setAgent3State] = useState<StepState>('Waiting');

  const [location, setLocation] = useState<{lat: number, lng: number} | null>(null);
  const [areaName, setAreaName] = useState("Locating...");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Get Location automatically
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setLocation({ lat, lng });
          
          try {
            // Reverse geocode roughly using OSM Nominatim for free
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=14`);
            const data = await res.json();
            setAreaName(data.name || data.address?.suburb || data.address?.city_district || data.address?.city || "Chennai Area");
          } catch (e) {
            setAreaName("Chennai Area");
          }
        },
        () => {
          // Default to somewhere in Chennai if denied
          setLocation({ lat: 13.0827, lng: 80.2707 });
          setAreaName("Chennai (Default)");
          toast.warning("Location access denied. Using default location. You can drag the pin on the map to adjust.");
        }
      );
    } else {
      setLocation({ lat: 13.0827, lng: 80.2707 });
      setAreaName("Chennai (Default)");
      toast.warning("Geolocation not supported. Using default location. You can drag the pin on the map to adjust.");
    }
  }, []);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxDimension = 800; // Compress image before upload

        if (width > height && width > maxDimension) {
          height *= maxDimension / width;
          width = maxDimension;
        } else if (height > maxDimension) {
          width *= maxDimension / height;
          height = maxDimension;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        
        // compress as JPEG
        const base64 = canvas.toDataURL('image/jpeg', 0.8);
        setPhotoData(base64);
        runPipeline(base64);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const runPipeline = async (base64: string) => {
    setIsAnalyzing(true);
    setAgent1State('Running');
    setAgent2State('Waiting');
    setAgent3State('Waiting');

    try {
      const res = await fetch('/api/analyze-issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64 })
      });
      
      const data = await res.json();
      
      if (!data.valid) {
        setAgent1State('Done');
        toast.error(data.message || "This doesn't look like a civic issue.", { autoClose: false });
        // Reset to let user try again
        setPhotoData(null);
        setIsAnalyzing(false);
        setAgent1State('Waiting');
        return;
      }

      setAgent1State('Done');
      // Simulate slight delay for UI visibility of Agent 2 & 3 steps since they are processed together on backend
      setAgent2State('Running');
      await new Promise(r => setTimeout(r, 800));
      setAgent2State('Done');
      
      setAgent3State('Running');
      await new Promise(r => setTimeout(r, 800));
      setAgent3State('Done');

      setAnalysisResult(data);
      setDescription(data.agent1.description);

    } catch (e) {
      toast.error("Analysis failed. Please try again or fill manually if implemented.");
      setIsAnalyzing(false);
      setAgent1State('Waiting');
      setPhotoData(null);
    }
  };

  const handleSubmit = async () => {
    if (!analysisResult || !location || !photoData) return;
    setIsSubmitting(true);

    try {
      // For this hackathon, we compressed the image client-side. 
      // Saving base64 directly to Firestore is much faster and avoids Firebase Storage CORS/Permission issues.
      const photoUrl = photoData;

      const { agent1, agent2, agent3 } = analysisResult;
      
      // Calculate initial impact score
      const initialDurationScore = 0; // Brand new
      const initialImpactScore = calculateImpactScore(
        agent2.severityScore, 
        agent2.safetyScore, 
        agent2.populationScore, 
        initialDurationScore
      );

      const impactScoreBreakdown = {
        severityScore: agent2.severityScore,
        safetyScore: agent2.safetyScore,
        populationScore: agent2.populationScore,
        durationScore: initialDurationScore,
        impactScore: initialImpactScore
      };

      // 2. Deduplication Check (Haversine < 200m)
      const duplicateIssue = existingIssues.find(i => 
        i.category === agent1.category && 
        i.status === 'Open' &&
        calculateDistance(location.lat, location.lng, i.lat, i.lng) < 200
      );

      // Severity auto-upgrade (Haversine < 500m)
      const nearbyIssues = existingIssues.filter(i =>
        i.category === agent1.category &&
        i.status === 'Open' &&
        calculateDistance(location.lat, location.lng, i.lat, i.lng) < 500
      );

      let finalSeverity = agent1.severity;
      if (!duplicateIssue && nearbyIssues.length >= 2) {
        const severities = ['Low', 'Medium', 'High', 'Critical'];
        const currIdx = severities.indexOf(finalSeverity);
        if (currIdx !== -1 && currIdx < 3) {
          finalSeverity = severities[currIdx + 1] as any;
          toast.info(`Severity auto-upgraded to ${finalSeverity} due to ${nearbyIssues.length} similar reports in this area!`, { autoClose: 5000 });
        }
      }

      if (duplicateIssue) {
        // Merge
        const issueRef = doc(db, 'issues', duplicateIssue.id);
        await updateDoc(issueRef, {
          citizenCount: duplicateIssue.citizenCount + 1,
          photos: [...duplicateIssue.photos, photoUrl]
        });
        toast.success("Your report has been merged with an existing issue nearby. You've strengthened the community report! (+5 points)");
        addPoints(5);
      } else {
        // Create new
        const newIssue = {
          category: agent1.category,
          severity: finalSeverity,
          description: description,
          lat: location.lat,
          lng: location.lng,
          areaName: areaName,
          timestamp: Date.now(),
          citizenCount: 1,
          upvotes: 0,
          status: 'Open',
          riskTrend: agent1.riskTrend,
          riskReason: agent1.riskReason,
          impactScoreBreakdown,
          agent2Output: agent2,
          agent3Output: agent3,
          photos: [photoUrl],
          afterPhoto: null,
          escalationLetter: null,
          sessionId: localStorage.getItem('communityHeroSessionId') || Date.now().toString()
        };
        await addDoc(collection(db, 'issues'), newIssue);
        toast.success("Issue reported successfully! (+10 points)");
        addPoints(10);
      }
      
      onClose();
    } catch (e) {
      console.error(e);
      toast.error("Failed to submit report.");
      setIsSubmitting(false);
    }
  };

  const StepIndicator = ({ label, state }: { label: string, state: StepState }) => (
    <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-md">
      <span className={clsx("font-medium text-sm", state === 'Done' ? "text-slate-800" : "text-slate-500")}>
        {label}
      </span>
      {state === 'Waiting' && <CircleDashed size={18} className="text-slate-300" />}
      {state === 'Running' && <Loader2 size={18} className="text-blue-500 animate-spin" />}
      {state === 'Done' && <CheckCircle2 size={18} className="text-emerald-500" />}
    </div>
  );

  return (
    <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-[2000] p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h2 className="text-lg font-bold text-slate-800">Report Civic Issue</h2>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {!photoData ? (
            <div 
              className="border-2 border-dashed border-slate-300 rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-slate-50 hover:border-blue-400 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={32} className="text-slate-400 mb-3" />
              <h3 className="font-semibold text-slate-700 mb-1">Upload Photo</h3>
              <p className="text-xs text-slate-500">Take a clear picture of the pothole, leak, or hazard.</p>
              <input 
                type="file" 
                accept="image/*" 
                className="hidden" 
                ref={fileInputRef}
                onChange={handlePhotoUpload}
              />
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              <div className="relative rounded-lg overflow-hidden h-48 border border-slate-200 bg-slate-900">
                <img src={photoData} alt="Upload preview" className="w-full h-full object-contain" />
              </div>

              {isAnalyzing && !analysisResult && (
                <div className="flex flex-col gap-2">
                  <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-2">AI Analysis Pipeline</h3>
                  <StepIndicator label="Agent 1: Issue Validation" state={agent1State} />
                  <StepIndicator label="Agent 2: Impact Estimation" state={agent2State} />
                  <StepIndicator label="Agent 3: Resolution Planner" state={agent3State} />
                </div>
              )}

              {analysisResult && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 flex flex-col gap-4">
                  <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-md text-sm font-medium flex items-center gap-2">
                    <CheckCircle2 size={18} /> Analysis Complete
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-50 p-3 rounded border border-slate-200">
                      <div className="text-[10px] uppercase font-bold text-slate-500 mb-1">Category</div>
                      <div className="font-semibold text-slate-800">{analysisResult.agent1.category}</div>
                    </div>
                    <div className="bg-slate-50 p-3 rounded border border-slate-200">
                      <div className="text-[10px] uppercase font-bold text-slate-500 mb-1">Severity</div>
                      <div className={clsx("font-bold", 
                        analysisResult.agent1.severity === 'Critical' ? "text-red-600" :
                        analysisResult.agent1.severity === 'High' ? "text-red-500" :
                        analysisResult.agent1.severity === 'Medium' ? "text-orange-500" : "text-emerald-500"
                      )}>
                        {analysisResult.agent1.severity}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Description</label>
                    <textarea 
                      className="w-full border border-slate-200 rounded p-2 text-sm text-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      rows={3}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  </div>

                  <div className="bg-slate-50 p-3 rounded border border-slate-200 flex flex-col gap-2">
                    <div className="text-[10px] uppercase font-bold text-slate-500 mb-1 block flex items-center gap-1">
                      <MapPin size={12} /> Location Detected
                    </div>
                    <div className="text-sm font-medium text-slate-800">{areaName}</div>
                    
                    <div className="h-32 w-full mt-1 rounded overflow-hidden z-0 border border-slate-200">
                      {location && (
                        <MapContainer center={[location.lat, location.lng]} zoom={14} className="h-full w-full" scrollWheelZoom={false}>
                          <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
                          <DraggableMarker location={location} setLocation={setLocation} setAreaName={setAreaName} />
                        </MapContainer>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-400 italic mt-1">Drag the pin to adjust the exact location if needed.</div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {analysisResult && (
          <div className="p-4 border-t border-slate-100 bg-slate-50 flex gap-3">
            <button 
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 text-slate-600 font-semibold hover:bg-slate-200 rounded transition-colors"
            >
              Cancel
            </button>
            <button 
              onClick={handleSubmit}
              disabled={isSubmitting || !location}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded shadow transition-colors flex justify-center items-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : "Submit Report"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
