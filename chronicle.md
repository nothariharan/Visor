# Chronicle Mode: Spatial Time Travel Implementation Plan

**Concept:** Transform the graph into an interactive Git timeline where users can physically checkout commits, see the architecture as it was, and test old versions directly.

**The Magic:** Click a commit → Files on disk change → Graph updates → You're literally looking at your project from 3 months ago.

---

## 🎯 Core Features

### What Chronicle Mode Does:
1. **Timeline Sidebar** - Shows Git commit history as a vertical timeline
2. **Time Travel** - Click commit → Checkout that exact point in history
3. **Visual Diff** - Nodes glow based on what changed (Added/Modified/Deleted)
4. **Test Old Versions** - Run old code, see old dependencies, debug old bugs
5. **Safe Return** - Big red "Return to Present" button
6. **History Comparison** - Compare any two commits side-by-side

### What Makes This Special:
- **No other IDE does this visually** - VS Code has Git history, but it's text-based
- **Graph shows architectural evolution** - See when complexity was introduced
- **Test historical bugs** - Reproduce issues from production
- **Understand refactoring decisions** - See before/after of major changes

---

## 🏗️ Architecture Overview

```
User Journey:
1. Click "Chronicle" mode
2. Sidebar loads commit history
3. Click a commit
4. Backend:
   - Stashes current changes (safety)
   - Checks out commit (detached HEAD)
   - Calculates diff (what changed)
5. Frontend:
   - Graph re-renders with old file structure
   - Nodes glow based on git status
   - Warning banner shows you're in past
6. User tests old code
7. Click "Return to Present"
8. Backend:
   - Checks out main/master
   - Restores stashed changes
   - Back to normal
```

---

## 📦 Backend Implementation

### Dependencies

```bash
npm install simple-git
```

### API Endpoints

#### 1. Get Commit History

```javascript
// GET /api/chronicle/history
// Returns list of commits

export async function getCommitHistory(rootDir) {
  const git = simpleGit(rootDir);
  
  try {
    const log = await git.log({
      maxCount: 100,  // Limit to most recent 100
      '--all': null,   // Include all branches
      '--date-order': null
    });
    
    return {
      success: true,
      commits: log.all.map(commit => ({
        hash: commit.hash,
        shortHash: commit.hash.substring(0, 7),
        message: commit.message,
        author: commit.author_name,
        email: commit.author_email,
        date: commit.date,
        timestamp: new Date(commit.date).getTime(),
        // Parse body for more details
        body: commit.body || '',
        refs: commit.refs || ''  // Branch/tag names
      }))
    };
  } catch (error) {
    return {
      success: false,
      error: 'Failed to read git history',
      details: error.message
    };
  }
}
```

#### 2. Get Current HEAD

```javascript
// GET /api/chronicle/current
// Returns current HEAD info

export async function getCurrentHead(rootDir) {
  const git = simpleGit(rootDir);
  
  try {
    const status = await git.status();
    const currentBranch = status.current;
    const isDetached = status.detached;
    
    if (isDetached) {
      // Get current commit in detached state
      const log = await git.log({ maxCount: 1 });
      return {
        success: true,
        isDetached: true,
        commit: log.latest.hash,
        originalBranch: await getOriginalBranch(rootDir)
      };
    }
    
    return {
      success: true,
      isDetached: false,
      branch: currentBranch
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Store original branch in temp file
async function getOriginalBranch(rootDir) {
  const tempFile = path.join(rootDir, '.visor', 'original_branch.txt');
  try {
    return fs.readFileSync(tempFile, 'utf-8').trim();
  } catch {
    return 'main'; // fallback
  }
}

async function storeOriginalBranch(rootDir, branch) {
  const tempFile = path.join(rootDir, '.visor', 'original_branch.txt');
  fs.writeFileSync(tempFile, branch);
}
```

#### 3. Check Repository Safety

```javascript
// GET /api/chronicle/check-safety
// Checks if safe to time travel

export async function checkSafety(rootDir) {
  const git = simpleGit(rootDir);
  
  try {
    const status = await git.status();
    
    // Check for uncommitted changes
    const hasChanges = 
      status.modified.length > 0 ||
      status.not_added.length > 0 ||
      status.created.length > 0 ||
      status.deleted.length > 0;
    
    // Check for merge conflicts
    const hasConflicts = status.conflicted.length > 0;
    
    // Check if in middle of rebase/merge
    const isRebasing = status.isRebasing();
    const isMerging = status.isMerging();
    
    return {
      success: true,
      safe: !hasConflicts && !isRebasing && !isMerging,
      warnings: {
        uncommittedChanges: hasChanges,
        conflicts: hasConflicts,
        rebasing: isRebasing,
        merging: isMerging
      },
      changedFiles: {
        modified: status.modified,
        added: status.not_added,
        deleted: status.deleted
      }
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
```

#### 4. Time Travel (Checkout Commit)

```javascript
// POST /api/chronicle/checkout
// Body: { hash: string, force?: boolean }

export async function timeTravel(rootDir, targetHash, options = {}) {
  const git = simpleGit(rootDir);
  
  try {
    // Step 1: Safety check
    const safety = await checkSafety(rootDir);
    
    if (!safety.safe && !options.force) {
      return {
        success: false,
        error: 'Repository not in safe state',
        warnings: safety.warnings,
        requiresForce: true
      };
    }
    
    // Step 2: Store current branch
    const current = await git.status();
    if (!current.detached) {
      await storeOriginalBranch(rootDir, current.current);
    }
    
    // Step 3: Stash uncommitted changes
    let stashMessage = `VISOR auto-stash before time travel to ${targetHash}`;
    let stashCreated = false;
    
    if (safety.warnings.uncommittedChanges) {
      try {
        const stashResult = await git.stash(['save', stashMessage]);
        stashCreated = stashResult.includes('Saved');
      } catch (e) {
        // Ignore if nothing to stash
      }
    }
    
    // Step 4: Checkout the target commit
    await git.checkout(targetHash);
    
    // Step 5: Get the diff to see what changed
    const diffSummary = await git.diffSummary([`${targetHash}^`, targetHash]);
    
    // Step 6: Parse diff into file changes
    const changes = {
      added: [],
      modified: [],
      deleted: [],
      renamed: []
    };
    
    diffSummary.files.forEach(file => {
      if (file.binary) return; // Skip binary files
      
      // Determine change type
      if (file.insertions > 0 && file.deletions === 0) {
        changes.added.push(file.file);
      } else if (file.insertions === 0 && file.deletions > 0) {
        changes.deleted.push(file.file);
      } else {
        changes.modified.push(file.file);
      }
    });
    
    return {
      success: true,
      commit: targetHash,
      stashCreated,
      changes,
      message: 'Successfully traveled to commit'
    };
    
  } catch (error) {
    return {
      success: false,
      error: 'Checkout failed',
      details: error.message
    };
  }
}
```

#### 5. Return to Present

```javascript
// POST /api/chronicle/return

export async function returnToPresent(rootDir) {
  const git = simpleGit(rootDir);
  
  try {
    // Step 1: Get original branch
    const originalBranch = await getOriginalBranch(rootDir);
    
    // Step 2: Checkout original branch
    await git.checkout(originalBranch);
    
    // Step 3: Look for VISOR stashes
    const stashes = await git.stashList();
    const visorStash = stashes.all.find(s => 
      s.message.includes('VISOR auto-stash')
    );
    
    // Step 4: Restore stash if exists
    if (visorStash) {
      try {
        await git.stash(['pop', visorStash.index]);
      } catch (error) {
        // If pop fails (conflicts), keep stash
        return {
          success: true,
          warning: 'Could not restore stashed changes due to conflicts',
          stashPreserved: true
        };
      }
    }
    
    // Step 5: Clean up temp files
    const tempFile = path.join(rootDir, '.visor', 'original_branch.txt');
    try {
      fs.unlinkSync(tempFile);
    } catch {}
    
    return {
      success: true,
      branch: originalBranch,
      message: 'Returned to present'
    };
    
  } catch (error) {
    return {
      success: false,
      error: 'Failed to return to present',
      details: error.message,
      recovery: 'Run: git checkout main && git stash pop'
    };
  }
}
```

#### 6. Get Commit Details

```javascript
// GET /api/chronicle/commit/:hash
// Returns detailed info about a commit

export async function getCommitDetails(rootDir, hash) {
  const git = simpleGit(rootDir);
  
  try {
    // Get commit info
    const log = await git.log({ from: hash, to: hash, maxCount: 1 });
    const commit = log.all[0];
    
    // Get files changed
    const diffSummary = await git.diffSummary([`${hash}^`, hash]);
    
    // Get full diff (for preview)
    const diff = await git.diff([`${hash}^`, hash]);
    
    // Parse stats
    const stats = {
      filesChanged: diffSummary.files.length,
      insertions: diffSummary.insertions,
      deletions: diffSummary.deletions
    };
    
    return {
      success: true,
      commit: {
        ...commit,
        stats,
        files: diffSummary.files.map(f => ({
          path: f.file,
          insertions: f.insertions,
          deletions: f.deletions,
          binary: f.binary
        })),
        diff  // Full diff text for preview
      }
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
```

#### 7. Compare Two Commits

```javascript
// GET /api/chronicle/compare?from=hash1&to=hash2
// Compares two commits

export async function compareCommits(rootDir, fromHash, toHash) {
  const git = simpleGit(rootDir);
  
  try {
    const diffSummary = await git.diffSummary([fromHash, toHash]);
    
    const changes = {
      added: [],
      modified: [],
      deleted: []
    };
    
    diffSummary.files.forEach(file => {
      if (file.insertions > 0 && file.deletions === 0) {
        changes.added.push({
          path: file.file,
          lines: file.insertions
        });
      } else if (file.insertions === 0 && file.deletions > 0) {
        changes.deleted.push({
          path: file.file,
          lines: file.deletions
        });
      } else {
        changes.modified.push({
          path: file.file,
          insertions: file.insertions,
          deletions: file.deletions
        });
      }
    });
    
    return {
      success: true,
      from: fromHash,
      to: toHash,
      changes,
      stats: {
        filesChanged: diffSummary.files.length,
        totalInsertions: diffSummary.insertions,
        totalDeletions: diffSummary.deletions
      }
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
```

---

## 🎨 Frontend Implementation

### 1. Chronicle Sidebar Component

```javascript
// src/components/ChronicleSidebar.jsx

export default function ChronicleSidebar() {
  const [commits, setCommits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCommit, setActiveCommit] = useState(null);
  const [currentHead, setCurrentHead] = useState(null);
  const [selectedCommit, setSelectedCommit] = useState(null); // For preview
  
  useEffect(() => {
    loadHistory();
    loadCurrentHead();
  }, []);
  
  const loadHistory = async () => {
    const response = await fetch('/api/chronicle/history');
    const data = await response.json();
    
    if (data.success) {
      setCommits(data.commits);
    }
    setLoading(false);
  };
  
  const loadCurrentHead = async () => {
    const response = await fetch('/api/chronicle/current');
    const data = await response.json();
    
    if (data.success) {
      setCurrentHead(data);
    }
  };
  
  const handleCheckout = async (hash) => {
    // Show confirmation if uncommitted changes
    const safety = await fetch('/api/chronicle/check-safety').then(r => r.json());
    
    if (safety.warnings.uncommittedChanges) {
      const confirmed = await showConfirmation(
        'You have uncommitted changes. They will be stashed. Continue?'
      );
      if (!confirmed) return;
    }
    
    // Checkout
    setLoading(true);
    const response = await fetch('/api/chronicle/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hash })
    });
    
    const data = await response.json();
    
    if (data.success) {
      setActiveCommit(hash);
      // Trigger graph re-render with changes
      onCommitChange(hash, data.changes);
    } else {
      showError(data.error);
    }
    
    setLoading(false);
  };
  
  const handlePreview = async (hash) => {
    // Load commit details for preview (don't checkout)
    const response = await fetch(`/api/chronicle/commit/${hash}`);
    const data = await response.json();
    
    if (data.success) {
      setSelectedCommit(data.commit);
    }
  };
  
  return (
    <div className="h-full flex flex-col bg-crust">
      {/* Header */}
      <div className="p-3 border-b-2 border-surface1 bg-mantle flex items-center justify-between">
        <span className="text-text font-mono text-xs font-bold">
          &gt; git log --oneline
        </span>
        
        {currentHead?.isDetached && (
          <span className="text-red text-[10px] animate-pulse">
            ⚠ DETACHED HEAD
          </span>
        )}
      </div>
      
      {/* Timeline */}
      <div className="flex-1 overflow-y-auto relative">
        {loading ? (
          <div className="p-8 text-center text-subtext0">
            Loading history...
          </div>
        ) : (
          <Timeline 
            commits={commits}
            activeCommit={activeCommit}
            currentHead={currentHead}
            onCheckout={handleCheckout}
            onPreview={handlePreview}
          />
        )}
      </div>
      
      {/* Commit Preview Panel */}
      {selectedCommit && (
        <CommitPreview 
          commit={selectedCommit}
          onClose={() => setSelectedCommit(null)}
        />
      )}
    </div>
  );
}
```

### 2. Timeline Component

```javascript
// src/components/Timeline.jsx

function Timeline({ commits, activeCommit, currentHead, onCheckout, onPreview }) {
  return (
    <div className="p-4 relative">
      {/* Vertical timeline line */}
      <div className="absolute left-6 top-0 bottom-0 w-[2px] bg-surface1" />
      
      {commits.map((commit, index) => {
        const isActive = commit.hash === activeCommit;
        const isCurrent = !currentHead?.isDetached && 
                         commit.hash === commits[0].hash;
        
        return (
          <TimelineItem
            key={commit.hash}
            commit={commit}
            isActive={isActive}
            isCurrent={isCurrent}
            onCheckout={onCheckout}
            onPreview={onPreview}
          />
        );
      })}
    </div>
  );
}

function TimelineItem({ commit, isActive, isCurrent, onCheckout, onPreview }) {
  const [expanded, setExpanded] = useState(false);
  
  return (
    <div className="relative mb-4 group">
      {/* Commit dot */}
      <div 
        className={`
          absolute left-[-14px] top-3 w-4 h-4 rounded-full 
          border-2 border-crust transition-all cursor-pointer
          ${isActive 
            ? 'bg-peach shadow-hard-peach scale-125' 
            : isCurrent
            ? 'bg-green shadow-hard-green'
            : 'bg-subtext0 group-hover:bg-text group-hover:scale-110'
          }
        `}
        onClick={() => onCheckout(commit.hash)}
      />
      
      {/* Commit card */}
      <div 
        className={`
          ml-8 p-3 rounded border transition-all cursor-pointer
          ${isActive 
            ? 'bg-surface0 border-peach' 
            : 'bg-mantle border-surface1 hover:border-text'
          }
        `}
        onClick={() => setExpanded(!expanded)}
        onMouseEnter={() => onPreview(commit.hash)}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-1">
          <span className={`
            font-mono text-xs font-bold
            ${isActive ? 'text-peach' : 'text-blue'}
          `}>
            {commit.shortHash}
          </span>
          
          {isCurrent && (
            <span className="text-green text-[10px] font-bold">
              HEAD
            </span>
          )}
        </div>
        
        {/* Message */}
        <div className="text-text text-sm mb-2">
          {commit.message}
        </div>
        
        {/* Meta */}
        <div className="flex items-center gap-3 text-[10px] text-subtext0">
          <span>{commit.author}</span>
          <span>{formatDate(commit.date)}</span>
          {commit.refs && (
            <span className="px-1 bg-blue/20 text-blue rounded">
              {commit.refs}
            </span>
          )}
        </div>
        
        {/* Expanded details */}
        {expanded && (
          <div className="mt-3 pt-3 border-t border-surface1 text-xs text-subtext0">
            <div>{commit.body}</div>
            
            <button 
              className="mt-2 text-blue hover:text-text"
              onClick={(e) => {
                e.stopPropagation();
                onCheckout(commit.hash);
              }}
            >
              → Time Travel to This Commit
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
```

### 3. Return to Present Button

```javascript
// src/components/ReturnButton.jsx

export function ReturnButton({ isDetached, onReturn }) {
  if (!isDetached) return null;
  
  const [loading, setLoading] = useState(false);
  
  const handleReturn = async () => {
    if (!confirm('Return to present? Any uncommitted changes will be restored.')) {
      return;
    }
    
    setLoading(true);
    const response = await fetch('/api/chronicle/return', {
      method: 'POST'
    });
    
    const data = await response.json();
    
    if (data.success) {
      onReturn();
    } else {
      alert(`Failed: ${data.error}\n\nRecovery: ${data.recovery}`);
    }
    
    setLoading(false);
  };
  
  return (
    <div className="fixed bottom-6 right-6 z-50 animate-pulse">
      <button
        onClick={handleReturn}
        disabled={loading}
        className="
          px-6 py-3 bg-red text-crust font-mono font-bold uppercase
          border-2 border-red shadow-hard-red
          hover:translate-y-[2px] hover:shadow-hard
          transition-all disabled:opacity-50
        "
      >
        {loading ? '⏳ Returning...' : '✕ Return to Present'}
      </button>
    </div>
  );
}
```

### 4. Graph Node Visual Diff

```javascript
// Update TerminalNode.jsx to show git status

export function TerminalNode({ data }) {
  const gitStatus = data.chronicleStatus; // 'added', 'modified', 'deleted'
  
  // Determine styling based on status
  const statusStyles = {
    added: 'border-green shadow-hard-green',
    modified: 'border-yellow shadow-hard-yellow',
    deleted: 'border-red shadow-hard-red opacity-50 grayscale'
  };
  
  const statusBadges = {
    added: { text: 'ADDED', color: 'text-green bg-green/10' },
    modified: { text: 'MODIFIED', color: 'text-yellow bg-yellow/10' },
    deleted: { text: 'DELETED', color: 'text-red bg-red/10' }
  };
  
  return (
    <div className={`
      node-card
      ${gitStatus ? statusStyles[gitStatus] : ''}
    `}>
      {/* Git status badge */}
      {gitStatus && (
        <div className={`
          absolute -top-3 -right-3 px-2 py-1 text-[10px] font-bold
          border rounded ${statusBadges[gitStatus].color}
        `}>
          {statusBadges[gitStatus].text}
        </div>
      )}
      
      {/* Rest of node content */}
      {/* ... */}
    </div>
  );
}
```

### 5. Detached HEAD Warning Banner

```javascript
// src/components/ChronicleWarning.jsx

export function ChronicleWarning({ currentCommit, onReturn }) {
  return (
    <div className="
      w-full px-4 py-2 bg-red/10 border-y-2 border-red
      flex items-center justify-between
    ">
      <div className="flex items-center gap-3 text-sm">
        <span className="text-red font-bold">⚠ TIME TRAVEL MODE</span>
        <span className="text-subtext0 font-mono text-xs">
          Viewing: {currentCommit}
        </span>
      </div>
      
      <button
        onClick={onReturn}
        className="text-xs text-red hover:text-text"
      >
        Return to Present →
      </button>
    </div>
  );
}
```

### 6. Commit Comparison Feature

```javascript
// src/components/CompareMode.jsx

export function CompareMode() {
  const [compareFrom, setCompareFrom] = useState(null);
  const [compareTo, setCompareTo] = useState(null);
  const [diff, setDiff] = useState(null);
  
  const handleCompare = async () => {
    if (!compareFrom || !compareTo) return;
    
    const response = await fetch(
      `/api/chronicle/compare?from=${compareFrom}&to=${compareTo}`
    );
    const data = await response.json();
    
    if (data.success) {
      setDiff(data);
      // Update graph to show differences
    }
  };
  
  return (
    <div className="compare-panel bg-mantle border-t-2 border-surface1 p-4">
      <div className="flex gap-4 mb-4">
        <CommitSelector 
          label="From:"
          value={compareFrom}
          onChange={setCompareFrom}
        />
        
        <CommitSelector 
          label="To:"
          value={compareTo}
          onChange={setCompareTo}
        />
        
        <button 
          onClick={handleCompare}
          className="bg-blue text-crust px-4 py-2"
        >
          Compare
        </button>
      </div>
      
      {diff && (
        <DiffStats diff={diff} />
      )}
    </div>
  );
}
```

---

## 🛡️ Safety Features

### 1. Pre-Flight Checks

**Before allowing time travel:**
- ✅ Check for uncommitted changes → Stash them
- ✅ Check for merge conflicts → Block until resolved
- ✅ Check if rebasing/merging → Block until complete
- ✅ Store original branch name → For safe return

### 2. Warning Modals

**Show warnings for:**
- Uncommitted changes will be stashed
- Detached HEAD state is temporary
- Running processes should be stopped
- Large diffs might take time to render

### 3. Recovery Instructions

**If something goes wrong:**
```javascript
// Always provide recovery commands
const recoverySteps = {
  'checkout-failed': 'git checkout main',
  'stash-conflict': 'git stash drop && git checkout main',
  'detached-stuck': 'git checkout main && git stash pop'
};

// Show in error modal
<div className="recovery-instructions font-mono text-xs">
  <div>Recovery commands:</div>
  <code className="bg-surface0 p-2 block">
    {recoverySteps[errorType]}
  </code>
</div>
```

### 4. Auto-Safety Timer

**Add a safety mechanism:**
```javascript
// Auto-warn if in detached HEAD for >30 minutes
useEffect(() => {
  if (!isDetached) return;
  
  const timer = setTimeout(() => {
    showWarning(
      'You've been in time travel mode for 30 minutes. Remember to return to present!'
    );
  }, 30 * 60 * 1000);
  
  return () => clearTimeout(timer);
}, [isDetached]);
```

---

## 🎨 Visual Enhancements

### 1. Timeline Animations

```css
/* Add to timeline items */
@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateX(-20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.timeline-item {
  animation: slideIn 0.3s ease-out;
  animation-delay: calc(var(--index) * 50ms);
}
```

### 2. Node Transition Effects

```css
/* Smooth transitions when nodes change status */
.node-card {
  transition: 
    border-color 0.3s ease,
    box-shadow 0.3s ease,
    opacity 0.3s ease,
    filter 0.3s ease;
}

.node-card.chronicle-added {
  animation: glow-green 1s ease-in-out;
}

@keyframes glow-green {
  0%, 100% { box-shadow: 0 0 10px rgba(166, 227, 161, 0.3); }
  50% { box-shadow: 0 0 30px rgba(166, 227, 161, 0.6); }
}
```

### 3. Commit Heat Map

```javascript
// Color commits by recency
const getCommitColor = (date) => {
  const age = Date.now() - new Date(date).getTime();
  const days = age / (1000 * 60 * 60 * 24);
  
  if (days < 7) return '#a6e3a1';    // Green (recent)
  if (days < 30) return '#f9e2af';   // Yellow
  if (days < 90) return '#fab387';   // Peach
  return '#585b70';                   // Gray (old)
};
```

---

## 📊 Additional Features

### 1. Commit Search

```javascript
// Search through commit messages
const [searchQuery, setSearchQuery] = useState('');

const filteredCommits = commits.filter(commit =>
  commit.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
  commit.author.toLowerCase().includes(searchQuery.toLowerCase())
);
```

### 2. Branch Visualization

```javascript
// Show which branch each commit belongs to
<span className="branch-badge">
  {commit.refs.split(',').map(ref => (
    <span key={ref} className={`
      px-2 py-1 text-[10px] rounded
      ${ref.includes('main') ? 'bg-green/20 text-green' : 'bg-blue/20 text-blue'}
    `}>
      {ref.trim()}
    </span>
  ))}
</span>
```

### 3. File Change Statistics

```javascript
// Show in commit preview
<div className="stats flex gap-4 text-xs">
  <span className="text-green">+{commit.stats.insertions}</span>
  <span className="text-red">-{commit.stats.deletions}</span>
  <span className="text-subtext0">{commit.stats.filesChanged} files</span>
</div>
```

### 4. Keyboard Shortcuts

```javascript
// Add keyboard navigation
useEffect(() => {
  const handleKey = (e) => {
    if (e.key === 'ArrowUp') {
      // Navigate to previous commit
    }
    if (e.key === 'ArrowDown') {
      // Navigate to next commit
    }
    if (e.key === 'Enter') {
      // Checkout selected commit
    }
    if (e.key === 'Escape') {
      // Return to present
    }
  };
  
  window.addEventListener('keydown', handleKey);
  return () => window.removeEventListener('keydown', handleKey);
}, []);
```

---

## ✅ Implementation Checklist

**Backend (6 hours):**
- [ ] Install simple-git
- [ ] Implement getCommitHistory()
- [ ] Implement getCurrentHead()
- [ ] Implement checkSafety()
- [ ] Implement timeTravel() with stashing
- [ ] Implement returnToPresent()
- [ ] Implement getCommitDetails()
- [ ] Implement compareCommits()
- [ ] Add error handling to all functions
- [ ] Test on real Git repo

**Frontend (10 hours):**
- [ ] Create ChronicleSidebar component
- [ ] Create Timeline component
- [ ] Create TimelineItem component
- [ ] Create ReturnButton component
- [ ] Create ChronicleWarning banner
- [ ] Update TerminalNode for git status
- [ ] Add commit preview panel
- [ ] Add loading states
- [ ] Add error modals
- [ ] Add keyboard shortcuts
- [ ] Test time travel flow
- [ ] Test return to present

**Polish (2 hours):**
- [ ] Add animations
- [ ] Add search
- [ ] Add branch badges
- [ ] Add statistics
- [ ] Test edge cases
- [ ] Write documentation

**Total: ~18 hours**

---

## 🚨 Known Limitations

**What Chronicle Can't Do (Yet):**
- ❌ Create new commits from past
- ❌ Cherry-pick commits
- ❌ Rebase interactively
- ❌ Resolve merge conflicts visually
- ❌ Show uncommitted changes in graph

**These are v3.1+ features**

---

## 🎯 Success Criteria

**Chronicle Mode is successful when:**
1. ✅ User can click any commit and see graph update
2. ✅ Graph accurately shows added/modified/deleted files
3. ✅ User can run old code (npm run dev works)
4. ✅ Return to present always works (never stuck)
5. ✅ Uncommitted changes are preserved
6. ✅ No data loss ever occurs

---

## 💡 Use Cases

**When developers will use this:**
1. **Debug production bug** - Checkout production commit, reproduce bug
2. **Understand refactoring** - See before/after of major changes
3. **Code archaeology** - "Why did we structure it this way?"
4. **Compare architectures** - See evolution over time
5. **Test old features** - See if bug existed in previous version
6. **Learn from history** - Study past decisions

---

This is **the most unique feature in VISOR** - no other IDE lets you physically checkout commits and see the architecture visually. This alone makes VISOR worth using. 🚀