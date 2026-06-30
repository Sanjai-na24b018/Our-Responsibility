import { useState, useEffect } from 'react';
import { db, auth, googleProvider } from './lib/firebase';
import { collection, onSnapshot, query, addDoc, updateDoc, doc } from 'firebase/firestore';
import { signInWithPopup, User as FirebaseUser, signOut } from 'firebase/auth';
import { Issue } from './types';
import MapView from './components/MapView';
import Dashboard from './components/Dashboard';
import ReportModal from './components/ReportModal';
import ProfileModal from './components/ProfileModal';
import { Plus, Search, User, LogIn, LogOut } from 'lucide-react';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

export default function App() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [points, setPoints] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [upvotedIssues, setUpvotedIssues] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('upvoted_issues');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [user, setUser] = useState<FirebaseUser | null>(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setUser(user);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      toast.success("Successfully logged in!");
    } catch (error) {
      console.error(error);
      toast.error("Failed to log in.");
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast.success("Successfully logged out!");
    } catch (error) {
      console.error(error);
      toast.error("Failed to log out.");
    }
  };

  useEffect(() => {
    // Load points from localStorage
    const savedPoints = localStorage.getItem('communityHeroPoints');
    if (savedPoints) {
      setPoints(parseInt(savedPoints, 10));
    }
  }, []);

  const addPoints = (amount: number) => {
    const newPoints = points + amount;
    setPoints(newPoints);
    localStorage.setItem('communityHeroPoints', newPoints.toString());
  };

  useEffect(() => {
    const q = query(collection(db, 'issues'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const loadedIssues = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as Issue[];
      setIssues(loadedIssues);
    });
    return () => unsubscribe();
  }, []);

  const updateIssueStatus = async (issueId: string, status: Issue['status']) => {
    try {
      await updateDoc(doc(db, 'issues', issueId), { status });
      toast.success(`Issue marked as ${status}`);
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Failed to update status");
    }
  };

  const escalateIssue = async (issue: Issue) => {
    toast.info("Escalating issue to authority...", { autoClose: 2000 });
    try {
      const res = await fetch('/api/escalate-issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issueData: issue })
      });
      const data = await res.json().catch(() => ({}));
      
      const letterText = data.letter || data.fallbackLetter;
      
      if (!res.ok && !letterText) {
        throw new Error(data.error || "Failed to escalate");
      }
      
      if (letterText) {
        await updateDoc(doc(db, 'issues', issue.id), {
          status: 'Escalated',
          escalationLetter: letterText
        });
        toast.success("Issue escalated and letter drafted!");
      }
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Escalation failed.");
    }
  };

  const upvoteIssue = async (issueId: string, currentUpvotes: number) => {
    if (upvotedIssues.includes(issueId)) {
      toast.warning("You have already upvoted this issue from this device.");
      return;
    }
    try {
      await updateDoc(doc(db, 'issues', issueId), { upvotes: currentUpvotes + 1 });
      const newUpvoted = [...upvotedIssues, issueId];
      setUpvotedIssues(newUpvoted);
      localStorage.setItem('upvoted_issues', JSON.stringify(newUpvoted));
      addPoints(5); // Reward user for participating
      toast.success("Thanks for verifying this issue! (+5 pts)");
    } catch (error) {
      console.error("Error upvoting issue:", error);
      toast.error("Failed to verify issue");
    }
  };

  const filteredIssues = issues.filter(issue => {
    const q = searchQuery.toLowerCase();
    return (
      (issue.category && issue.category.toLowerCase().includes(q)) ||
      (issue.description && issue.description.toLowerCase().includes(q)) ||
      (issue.areaName && issue.areaName.toLowerCase().includes(q))
    );
  });

  return (
    <div className="flex flex-col md:flex-row h-[100dvh] bg-slate-50 overflow-hidden font-sans">
      <ToastContainer position="top-center" />
      {/* Sidebar Dashboard */}
      <div className="w-full md:w-96 bg-white border-b md:border-r border-slate-200 flex flex-col z-10 shadow-lg h-[40vh] md:h-full">
        <div className="p-4 bg-slate-900 text-white flex flex-col gap-4 shrink-0">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-xl font-bold tracking-tight">Our Responsibility</h1>
              <p className="text-xs text-slate-400">Chennai Civic Intelligence</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="bg-slate-800 px-3 py-1 rounded-full border border-slate-700 flex items-center gap-2 cursor-pointer hover:bg-slate-700 transition-colors" onClick={() => setIsProfileOpen(true)}>
                <span className="text-sm font-medium text-emerald-400">{points} pts</span>
              </div>
              <button 
                onClick={() => setIsProfileOpen(true)}
                className="bg-slate-800 p-1.5 rounded-full border border-slate-700 hover:bg-slate-700 transition-colors text-slate-300 hover:text-white"
              >
                <User size={16} />
              </button>
            </div>
          </div>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search issues by title or description..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-800 text-sm text-white rounded-md pl-9 pr-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500 border border-slate-700 placeholder-slate-400"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          <Dashboard 
            issues={filteredIssues} 
            points={points} 
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
            onSelectIssue={setSelectedIssue}
            onUpdateStatus={updateIssueStatus}
            onUpvote={upvoteIssue}
            onEscalate={escalateIssue}
            upvotedIssues={upvotedIssues}
          />
        </div>
      </div>

      {/* Main Map Area */}
      <div className="flex-1 relative h-[60vh] md:h-full">
        <MapView 
          issues={filteredIssues} 
          addPoints={addPoints} 
          selectedCategory={selectedCategory}
          selectedIssue={selectedIssue}
          onEscalate={escalateIssue}
          upvotedIssues={upvotedIssues}
        />
        
        {/* Floating Report Button */}
        <button
          onClick={() => {
            if (!user) {
              toast.warn("Please log in to report issues");
              handleLogin();
            } else {
              setIsReportModalOpen(true);
            }
          }}
          className="absolute bottom-6 left-1/2 -translate-x-1/2 md:bottom-8 z-[1000] bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-full shadow-xl transition-transform hover:scale-105 active:scale-95 flex items-center gap-2"
        >
          <Plus size={24} />
          <span className="font-semibold pr-2 hidden md:inline">Report Issue</span>
        </button>
      </div>

      {isReportModalOpen && (
        <ReportModal 
          onClose={() => setIsReportModalOpen(false)} 
          addPoints={addPoints}
          existingIssues={issues}
        />
      )}

      {isProfileOpen && (
        <ProfileModal 
          points={points}
          issues={issues}
          onClose={() => setIsProfileOpen(false)}
          user={user}
          onLogin={handleLogin}
          onLogout={handleLogout}
        />
      )}
    </div>
  );
}
