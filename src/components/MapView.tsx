import React, { useEffect, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Circle } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Issue } from '../types';
import { calculateDistance, calculateDurationScore, calculateImpactScore, calculateNeighborhoodHealth } from '../utils/helpers';
import { updateDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { toast } from 'react-toastify';
import { AlertTriangle, Clock, MapPin, Users, CheckCircle, ShieldAlert, ArrowUpCircle, ExternalLink, LocateFixed } from 'lucide-react';
import clsx from 'clsx';
import ResolveModal from './ResolveModal';

// Fix Leaflet default icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

function getMarkerColor(severity: string) {
  if (severity === 'High' || severity === 'Critical') return '#ef4444'; // red-500
  if (severity === 'Medium') return '#f97316'; // orange-500
  return '#22c55e'; // green-500
}

const createCustomIcon = (severity: string) => {
  const color = getMarkerColor(severity);
  return L.divIcon({
    className: 'custom-leaflet-marker',
    html: `<div style="background-color: ${color}; width: 16px; height: 16px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 4px rgba(0,0,0,0.5);"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8]
  });
};

function LocateControl() {
  const map = useMap();
  const [locating, setLocating] = useState(false);

  const handleLocate = () => {
    setLocating(true);
    map.locate({ setView: true, maxZoom: 16 });
    map.once('locationfound', () => {
      setLocating(false);
    });
    map.once('locationerror', (e) => {
      setLocating(false);
      toast.error('Could not find your location');
    });
  };

  return (
    <div className="absolute bottom-6 right-4 z-[1000]">
      <button 
        onClick={handleLocate}
        disabled={locating}
        title="My Location"
        className="bg-white p-3 rounded-full shadow-lg border border-slate-200 hover:bg-slate-50 transition-colors disabled:opacity-50 flex items-center justify-center text-slate-700"
      >
        <LocateFixed size={24} className={locating ? "animate-pulse text-blue-500" : ""} />
      </button>
    </div>
  );
}

interface MapViewProps {
  issues: Issue[];
  addPoints: (points: number) => void;
  selectedCategory: string | null;
  selectedIssue: Issue | null;
  onEscalate: (issue: Issue) => void;
  upvotedIssues: string[];
}

function MapController({ selectedIssue }: { selectedIssue: Issue | null }) {
  const map = useMap();
  useEffect(() => {
    if (selectedIssue) {
      map.flyTo([selectedIssue.lat, selectedIssue.lng], 16, { duration: 1.5 });
    }
  }, [selectedIssue, map]);
  return null;
}

export default function MapView({ issues, addPoints, selectedCategory, selectedIssue, onEscalate, upvotedIssues }: MapViewProps) {
  // Default to Chennai
  const defaultCenter: [number, number] = [13.0827, 80.2707];

  const [resolvingIssue, setResolvingIssue] = useState<Issue | null>(null);

  const handleUpvote = async (issue: Issue) => {
    try {
      const issueRef = doc(db, 'issues', issue.id);
      
      // AI Severity Auto-Upgrade logic: check similar issues within 500m
      const nearbySimilar = issues.filter(i => 
        i.id !== issue.id && 
        i.category === issue.category && 
        calculateDistance(issue.lat, issue.lng, i.lat, i.lng) < 500
      );

      let newSeverity = issue.severity;
      let severityUpgraded = false;
      let newSeverityScore = issue.impactScoreBreakdown.severityScore;

      if (nearbySimilar.length >= 2) { // 2 others + this one = 3
        if (issue.severity === 'Low') {
          newSeverity = 'Medium';
          newSeverityScore = 66;
          severityUpgraded = true;
        } else if (issue.severity === 'Medium') {
          newSeverity = 'High';
          newSeverityScore = 100;
          severityUpgraded = true;
        }
      }

      let newImpactScore = issue.impactScoreBreakdown.impactScore;
      let newImpactBreakdown = { ...issue.impactScoreBreakdown };

      if (severityUpgraded) {
        newImpactBreakdown.severityScore = newSeverityScore;
        newImpactScore = calculateImpactScore(
          newSeverityScore,
          newImpactBreakdown.safetyScore,
          newImpactBreakdown.populationScore,
          calculateDurationScore(issue.timestamp)
        );
        newImpactBreakdown.impactScore = newImpactScore;
        toast.info(`AI Agent upgraded severity to ${newSeverity} based on ${nearbySimilar.length + 1} similar reports in this area.`);
      }

      await updateDoc(issueRef, {
        upvotes: issue.upvotes + 1,
        severity: newSeverity,
        impactScoreBreakdown: newImpactBreakdown
      });

      addPoints(2);
      toast.success("Issue upvoted! +2 pts");
    } catch (e) {
      toast.error("Failed to upvote.");
    }
  };

  const handleResolve = (issue: Issue) => {
    setResolvingIssue(issue);
  };

  // Group issues into neighborhoods for health badges (naive 1km grid approach)
  const displayedIssues = selectedCategory ? issues.filter(i => i.category === selectedCategory) : issues;

  const neighborhoods = useMemo(() => {
    const clusters = new Map<string, Issue[]>();
    displayedIssues.forEach(issue => {
      // 0.01 deg is approx 1.1km
      const gridLat = Math.round(issue.lat / 0.01) * 0.01;
      const gridLng = Math.round(issue.lng / 0.01) * 0.01;
      const key = `${gridLat.toFixed(2)},${gridLng.toFixed(2)}`;
      if (!clusters.has(key)) clusters.set(key, []);
      clusters.get(key)!.push(issue);
    });

    const results = [];
    for (const [key, clusterIssues] of clusters.entries()) {
      const [latStr, lngStr] = key.split(',');
      const lat = parseFloat(latStr);
      const lng = parseFloat(lngStr);
      const health = calculateNeighborhoodHealth(clusterIssues);
      results.push({ lat, lng, health, issues: clusterIssues });
    }
    return results;
  }, [issues]);

  return (
    <div className="h-full w-full relative">
      <MapContainer center={defaultCenter} zoom={13} className="h-full w-full z-0">
        <MapController selectedIssue={selectedIssue} />
        <LocateControl />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />

        {/* Render neighborhoods health badges */}
        {neighborhoods.map((n, i) => (
          <Marker 
            key={`nh-${i}`} 
            position={[n.lat, n.lng]}
            icon={L.divIcon({
              className: 'bg-transparent border-none',
              html: `<div class="flex items-center justify-center w-8 h-8 rounded-full border-2 border-white shadow-lg text-xs font-bold text-white
                ${n.health.score >= 80 ? 'bg-emerald-500' : n.health.score >= 50 ? 'bg-amber-500' : 'bg-rose-500'}
              ">${n.health.score}</div>`,
              iconSize: [32, 32],
              iconAnchor: [16, 16]
            })}
          >
            <Popup className="w-64">
              <div className="p-1">
                <h3 className="font-bold text-sm mb-1">Neighborhood Health</h3>
                <div className="text-3xl font-black mb-2 flex items-baseline gap-1">
                  {n.health.score} <span className="text-xs text-gray-500 font-normal">/ 100</span>
                </div>
                <p className="text-xs text-gray-700">{n.health.breakdown}</p>
              </div>
            </Popup>
          </Marker>
        ))}

        {displayedIssues.map(issue => {
          // Dynamic recalculation of duration/impact on display
          const currentDurationScore = calculateDurationScore(issue.timestamp);
          const displayImpactScore = calculateImpactScore(
            issue.impactScoreBreakdown.severityScore,
            issue.impactScoreBreakdown.safetyScore,
            issue.impactScoreBreakdown.populationScore,
            currentDurationScore
          );

          const hoursOld = Math.round((Date.now() - issue.timestamp) / (1000 * 60 * 60));
          const canEscalate = issue.upvotes >= 20 || hoursOld > 48;

          return (
            <React.Fragment key={`frag-${issue.id}`}>
              <Marker 
                key={`marker-${issue.id}`}
                position={[issue.lat, issue.lng]}
              icon={createCustomIcon(issue.severity)}
            >
              <Popup className="custom-popup w-80">
                <div className="flex flex-col gap-3 -mx-2 -my-1">
                  {issue.photos[0] && (
                    <img src={issue.photos[0]} alt="Issue" className="w-full h-32 object-cover rounded-t-md" />
                  )}
                  
                  <div className="px-3 pb-2 flex flex-col gap-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-bold text-gray-900 text-sm">{issue.category}</div>
                        <div className="text-xs text-gray-500 flex items-center gap-1">
                          <MapPin size={10} /> {issue.areaName || 'Unknown Area'}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <div className="flex gap-1">
                          {issue.status === 'Escalated' && (
                            <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-sm bg-orange-100 text-orange-800 border border-orange-200">
                              Escalated
                            </span>
                          )}
                          <span className={clsx(
                            "text-[10px] uppercase font-bold px-2 py-0.5 rounded-sm text-white",
                            issue.severity === 'Critical' ? "bg-red-600" :
                            issue.severity === 'High' ? "bg-red-500" :
                            issue.severity === 'Medium' ? "bg-orange-500" : "bg-emerald-500"
                          )}>
                            {issue.severity}
                          </span>
                        </div>
                        <div className="group relative">
                          <div className="bg-slate-900 text-white text-xs font-bold px-2 py-1 rounded cursor-help">
                            Impact: {displayImpactScore}
                          </div>
                          <div className="absolute hidden group-hover:block bottom-full right-0 mb-2 w-48 p-2 bg-slate-800 text-slate-200 text-[10px] rounded shadow-lg z-50">
                            <div className="font-semibold text-white mb-1">Impact Score Breakdown</div>
                            <div className="flex justify-between"><span>Severity (40%):</span> <span>{issue.impactScoreBreakdown.severityScore}/100</span></div>
                            <div className="flex justify-between"><span>Safety (30%):</span> <span>{issue.impactScoreBreakdown.safetyScore}/100</span></div>
                            <div className="flex justify-between"><span>Population (20%):</span> <span>{issue.impactScoreBreakdown.populationScore}/100</span></div>
                            <div className="flex justify-between"><span>Duration (10%):</span> <span>{Math.round(currentDurationScore)}/100</span></div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <p className="text-xs text-gray-700">{issue.description}</p>

                    <div className="bg-slate-50 p-2 rounded border border-slate-100 flex flex-col gap-1">
                      <div className="flex items-start gap-1.5 text-xs">
                        <AlertTriangle size={12} className="text-orange-500 mt-0.5 shrink-0" />
                        <span><strong>Risk:</strong> {issue.riskTrend} - {issue.riskReason}</span>
                      </div>
                      <div className="flex items-start gap-1.5 text-xs">
                        <ShieldAlert size={12} className="text-blue-500 mt-0.5 shrink-0" />
                        <span><strong>Action:</strong> {issue.agent3Output.immediateAction}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-1">
                        <Clock size={12} /> {hoursOld}h ago
                        <span className="mx-1">•</span>
                        <Users size={12} /> {issue.citizenCount} affected
                      </div>
                    </div>
                    
                    {issue.status === 'Escalated' && issue.escalationLetter && (
                      <div className="mt-2 p-2 bg-slate-50 border border-slate-200 rounded text-xs">
                        <div className="font-semibold text-slate-700 mb-1 flex justify-between items-center">
                          <span>Email Draft for Authorities</span>
                          <a 
                            href={`https://mail.google.com/mail/?view=cm&fs=1&su=${encodeURIComponent("Urgent: " + issue.category + " at " + issue.areaName)}&body=${encodeURIComponent(issue.escalationLetter)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-blue-600 text-white px-2 py-0.5 rounded flex items-center gap-1 hover:bg-blue-700 transition-colors"
                          >
                            <ExternalLink size={10} /> Send
                          </a>
                        </div>
                        <div className="text-slate-600 h-20 overflow-y-auto whitespace-pre-wrap border bg-white p-1.5 rounded">
                          {issue.escalationLetter}
                        </div>
                      </div>
                    )}

                    {issue.status === 'Open' && (
                      <div className="flex gap-2 mt-2">
                        <button 
                          onClick={() => handleUpvote(issue)}
                          disabled={upvotedIssues.includes(issue.id)}
                          className={clsx(
                            "flex-1 border py-1.5 rounded text-xs font-semibold flex items-center justify-center gap-1 transition-colors",
                            upvotedIssues.includes(issue.id)
                              ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
                              : "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200"
                          )}
                        >
                          <ArrowUpCircle size={14} /> I see this ({issue.upvotes})
                        </button>
                        
                        <button 
                          onClick={() => onEscalate(issue)}
                          disabled={!canEscalate}
                          className={clsx(
                            "flex-1 py-1.5 rounded text-xs font-semibold flex items-center justify-center gap-1 transition-colors border",
                            canEscalate 
                              ? "bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200" 
                              : "bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed"
                          )}
                          title={!canEscalate ? "Need 20 upvotes or 48h to escalate" : ""}
                        >
                          <AlertTriangle size={14} /> Escalate
                        </button>
                      </div>
                    )}
                    
                    {issue.status !== 'Resolved' && (
                      <button 
                        onClick={() => handleResolve(issue)}
                        className="w-full bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 py-1.5 rounded text-xs font-semibold flex items-center justify-center gap-1 transition-colors mt-1"
                      >
                        <CheckCircle size={14} /> Mark Resolved
                      </button>
                    )}
                  </div>
                </div>
              </Popup>
            </Marker>
            </React.Fragment>
          );
        })}
      </MapContainer>
      
      {/* Global styles for popup to ensure no weird padding */}
      <style>{`
        .custom-popup .leaflet-popup-content-wrapper { padding: 0; overflow: hidden; }
        .custom-popup .leaflet-popup-content { margin: 0; width: 100% !important; }
      `}</style>
      
      {resolvingIssue && (
        <ResolveModal 
          issue={resolvingIssue}
          onClose={() => setResolvingIssue(null)}
          addPoints={addPoints}
        />
      )}
    </div>
  );
}
