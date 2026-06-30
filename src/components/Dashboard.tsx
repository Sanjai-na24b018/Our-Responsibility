import { Issue } from '../types';
import { calculateDurationScore, calculateImpactScore, calculateNeighborhoodHealth } from '../utils/helpers';
import clsx from 'clsx';
import { AlertTriangle, CheckCircle, Clock, Filter, X, ThumbsUp } from 'lucide-react';

interface DashboardProps {
  issues: Issue[];
  points: number;
  selectedCategory: string | null;
  onSelectCategory: (category: string | null) => void;
  onSelectIssue: (issue: Issue) => void;
  onUpdateStatus: (issueId: string, status: Issue['status']) => void;
  onUpvote: (issueId: string, currentUpvotes: number) => void;
  onEscalate: (issue: Issue) => void;
  upvotedIssues: string[];
}

export default function Dashboard({ issues, points, selectedCategory, onSelectCategory, onSelectIssue, onUpdateStatus, onUpvote, onEscalate, upvotedIssues }: DashboardProps) {
  const openIssues = issues.filter(i => i.status === 'Open').length;
  const inProgressIssues = issues.filter(i => i.status === 'In Progress').length;
  const escalatedIssues = issues.filter(i => i.status === 'Escalated').length;
  const resolvedIssues = issues.filter(i => i.status === 'Resolved').length;

  const categories = issues.reduce((acc, issue) => {
    acc[issue.category] = (acc[issue.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const sortedCategories = Object.entries(categories).sort((a, b) => b[1] - a[1]);

  const displayedIssues = selectedCategory ? issues.filter(i => i.category === selectedCategory) : issues;

  const { score: avgHealthScore } = calculateNeighborhoodHealth(displayedIssues);

  // Calculate dynamic impact scores for sorting
  const issuesWithDynamicImpact = displayedIssues.map(issue => {
    const currentDurationScore = calculateDurationScore(issue.timestamp);
    const displayImpactScore = calculateImpactScore(
      issue.impactScoreBreakdown.severityScore,
      issue.impactScoreBreakdown.safetyScore,
      issue.impactScoreBreakdown.populationScore,
      currentDurationScore
    );
    return { ...issue, displayImpactScore };
  });

  const priorityIssues = [...issuesWithDynamicImpact]
    .filter(i => i.status !== 'Resolved')
    .sort((a, b) => b.displayImpactScore - a.displayImpactScore)
    .slice(0, 3);
    
  const allIssues = [...issuesWithDynamicImpact]
    .sort((a, b) => b.timestamp - a.timestamp);

  const getStatusColor = (status: Issue['status']) => {
    switch (status) {
      case 'Open': return 'bg-rose-100 text-rose-800 border-rose-200';
      case 'In Progress': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Escalated': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'Resolved': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      default: return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  return (
    <div className="p-4 flex flex-col gap-6">
      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-slate-50 p-2 rounded border border-slate-200 text-center">
          <div className="text-xl font-black text-slate-800">{issues.length}</div>
          <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Total</div>
        </div>
        <div className="bg-orange-50 p-2 rounded border border-orange-200 text-center">
          <div className="text-xl font-black text-orange-600">{openIssues + inProgressIssues + escalatedIssues}</div>
          <div className="text-[10px] uppercase font-bold text-orange-500 tracking-wider">Active</div>
        </div>
        <div className="bg-emerald-50 p-2 rounded border border-emerald-200 text-center">
          <div className="text-xl font-black text-emerald-600">{resolvedIssues}</div>
          <div className="text-[10px] uppercase font-bold text-emerald-500 tracking-wider">Fixed</div>
        </div>
      </div>

      {/* Category Filter */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-2">
          <Filter size={14} /> Filter by Category
        </h3>
        <div className="flex flex-wrap gap-2">
          {sortedCategories.map(([cat, count]) => (
            <button
              key={cat}
              onClick={() => onSelectCategory(selectedCategory === cat ? null : cat)}
              className={clsx(
                "px-2 py-1 text-xs font-semibold rounded border transition-colors flex items-center gap-1",
                selectedCategory === cat 
                  ? "bg-blue-100 text-blue-800 border-blue-300" 
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              )}
            >
              {cat} <span className="text-[10px] bg-slate-100 px-1 rounded text-slate-500">{count}</span>
            </button>
          ))}
          {selectedCategory && (
            <button
              onClick={() => onSelectCategory(null)}
              className="px-2 py-1 text-xs font-semibold rounded border bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100 flex items-center gap-1"
            >
              <X size={12} /> Clear Filter
            </button>
          )}
        </div>
      </div>

      {/* Global Health */}
      <div className="bg-slate-900 rounded-lg p-4 text-white flex items-center justify-between">
        <div>
          <div className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-1">City Health Index</div>
          <div className="text-sm text-slate-300">Based on active reports</div>
        </div>
        <div className={clsx(
          "text-3xl font-black",
          avgHealthScore >= 80 ? "text-emerald-400" :
          avgHealthScore >= 50 ? "text-amber-400" : "text-rose-400"
        )}>
          {avgHealthScore}
        </div>
      </div>

      {/* Priority Issues Board */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-2">
          <AlertTriangle size={14} /> Priority Action Board
        </h3>
        <div className="flex flex-col gap-2">
          {priorityIssues.length === 0 ? (
            <div className="text-sm text-slate-400 italic bg-slate-50 p-3 rounded text-center">No active issues</div>
          ) : (
            priorityIssues.map(issue => (
              <div 
                key={issue.id}
                onClick={() => onSelectIssue(issue)}
                className={clsx(
                  "p-3 rounded-md border text-sm transition-colors cursor-pointer",
                  issue.agent3Output.escalationUrgency === 'Critical' ? "bg-rose-50 border-rose-200 hover:bg-rose-100" :
                  issue.agent3Output.escalationUrgency === 'Urgent' ? "bg-orange-50 border-orange-200 hover:bg-orange-100" :
                  "bg-white border-slate-200 hover:bg-slate-50"
                )}
              >
                <div className="flex justify-between items-start mb-1">
                  <span className="font-bold text-slate-800">{issue.category}</span>
                  <span className="bg-slate-800 text-white text-[10px] px-1.5 py-0.5 rounded font-bold">
                    Score: {issue.displayImpactScore}
                  </span>
                </div>
                <div className="text-xs text-slate-600 truncate">{issue.areaName}</div>
                <div className="text-[10px] text-slate-500 mt-2 font-medium">
                  {issue.agent3Output.responsibleAuthority}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* All Issues List */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-2">
          <Clock size={14} /> Recent Reports
        </h3>
        <div className="flex flex-col gap-2 max-h-80 overflow-y-auto pr-1">
          {allIssues.length === 0 ? (
            <div className="text-sm text-slate-400 italic bg-slate-50 p-3 rounded text-center">No reports yet</div>
          ) : (
            allIssues.map(issue => {
              const hoursOld = (Date.now() - new Date(issue.timestamp).getTime()) / (1000 * 60 * 60);
              const canEscalate = (issue.upvotes || 0) >= 20 || hoursOld > 48;
              return (
              <div 
                key={issue.id}
                onClick={() => onSelectIssue(issue)}
                className={clsx(
                  "p-3 rounded-md border text-sm transition-colors cursor-pointer flex flex-col gap-2",
                  issue.status === 'Escalated' 
                    ? "bg-orange-50 border-orange-200 hover:bg-orange-100" 
                    : "bg-white border-slate-200 hover:bg-slate-50"
                )}
              >
                <div className="flex justify-between items-start">
                  <span className="font-bold text-slate-800">{issue.category}</span>
                  {points >= 200 ? (
                      <select
                        value={issue.status}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => {
                          e.stopPropagation();
                          onUpdateStatus(issue.id, e.target.value as Issue['status']);
                        }}
                        className={clsx(
                          "text-[10px] px-1.5 py-0.5 rounded font-bold uppercase cursor-pointer border outline-none",
                          getStatusColor(issue.status)
                        )}
                      >
                        <option value="Open">Open</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Resolved">Resolved</option>
                      </select>
                  ) : (
                    <div className="group relative">
                      <span className={clsx(
                        "text-[10px] px-1.5 py-0.5 rounded font-bold uppercase border cursor-not-allowed",
                        getStatusColor(issue.status)
                      )}>
                        {issue.status}
                      </span>
                      <div className="absolute top-full mt-1 right-0 w-32 bg-slate-800 text-white text-[10px] p-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none">
                        Requires 100 reputation points to update status.
                      </div>
                    </div>
                  )}
                </div>
                <div className="text-xs text-slate-600 truncate">{issue.areaName}</div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[10px] text-slate-400">{new Date(issue.timestamp).toLocaleDateString()}</span>
                  <div className="flex gap-2">
                    {points >= 200 && issue.status === 'Open' && (
                      <div className="group/esc relative">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            if (canEscalate) onEscalate(issue);
                          }}
                          disabled={!canEscalate}
                          className={clsx(
                            "flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded transition-colors",
                            canEscalate
                              ? "text-orange-600 hover:text-white bg-orange-100 hover:bg-orange-500"
                              : "text-slate-400 bg-slate-100 cursor-not-allowed"
                          )}
                        >
                          <AlertTriangle size={12} />
                          Escalate
                        </button>
                        <div className="absolute bottom-full mb-1 right-0 w-36 bg-slate-800 text-white text-[10px] p-1.5 rounded opacity-0 group-hover/esc:opacity-100 transition-opacity z-10 pointer-events-none">
                          {canEscalate 
                            ? "Flags this issue for urgent review by authorities." 
                            : "Need 20 upvotes or 48h to escalate"}
                        </div>
                      </div>
                    )}
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        onUpvote(issue.id, issue.upvotes || 0);
                      }}
                      disabled={upvotedIssues.includes(issue.id)}
                      className={clsx(
                        "flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded transition-colors",
                        upvotedIssues.includes(issue.id)
                          ? "text-blue-600 bg-blue-50 cursor-not-allowed"
                          : "text-slate-500 hover:text-blue-600 bg-slate-100 hover:bg-blue-50"
                      )}
                    >
                      <ThumbsUp size={12} />
                      {issue.upvotes || 0} Affected
                    </button>
                  </div>
                </div>
                {issue.status === 'Escalated' && issue.escalationLetter && (
                  <div className="mt-2 p-2 bg-slate-100 border border-slate-200 rounded text-[10px]">
                    <div className="font-semibold text-slate-700 mb-1 flex justify-between items-center">
                      <span>Email Draft</span>
                      <a 
                        href={`https://mail.google.com/mail/?view=cm&fs=1&su=${encodeURIComponent("Urgent: " + issue.category + " at " + issue.areaName)}&body=${encodeURIComponent(issue.escalationLetter)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-blue-600 text-white px-2 py-0.5 rounded flex items-center gap-1 hover:bg-blue-700 transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Send
                      </a>
                    </div>
                    <div className="text-slate-600 h-12 overflow-y-auto whitespace-pre-wrap border bg-white p-1 rounded">
                      {issue.escalationLetter}
                    </div>
                  </div>
                )}
              </div>
              );
            })
          )}
        </div>
      </div>

      {/* Categories Bar Chart */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Issue Distribution</h3>
        <div className="flex flex-col gap-2">
          {sortedCategories.length === 0 ? (
             <div className="text-sm text-slate-400 italic text-center">No data</div>
          ) : (
            sortedCategories.map(([cat, count]) => (
              <div key={cat} className="flex items-center gap-2 text-xs">
                <div className="w-24 truncate font-medium text-slate-700">{cat}</div>
                <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div 
                    className="bg-blue-500 h-full rounded-full" 
                    style={{ width: `${(count / issues.length) * 100}%` }}
                  />
                </div>
                <div className="w-6 text-right font-bold text-slate-500">{count}</div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Top Heroes Leaderboard */}
      <div className="mt-auto">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Top Heroes (Session)</h3>
        <div className="bg-white border border-slate-200 rounded-md overflow-hidden">
          {[
            { name: "Priya", score: 450, isMe: false },
            { name: "Rahul", score: 320, isMe: false },
            { name: "You", score: points, isMe: true }
          ].sort((a, b) => b.score - a.score).map((hero, idx) => (
            <div key={hero.name} className={clsx(
              "flex justify-between items-center p-2 text-sm",
              idx !== 2 && "border-b border-slate-100",
              hero.isMe ? "bg-blue-50 font-bold text-blue-900" : "text-slate-700"
            )}>
              <div className="flex items-center gap-2">
                <div className="w-5 text-center text-xs text-slate-400 font-bold">{idx + 1}</div>
                <div>{hero.name}</div>
              </div>
              <div className="font-mono text-xs font-bold">{hero.score} pts</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
