class FlowchartViewer {
    constructor() {
        this.flowchartContainer = document.getElementById('flowchart');
        this.flowchartPanel = document.getElementById('flowchart-panel');
        // Top-right controls: previously zoom in/out/reset, now undo/redo/open.
        // Zooming itself is still available via scroll-wheel / pinch (see setupZoom).
        this.topUndoBtn = document.getElementById('top-undo-btn');
        this.topRedoBtn = document.getElementById('top-redo-btn');
        this.topOpenBtn = document.getElementById('top-open-btn');
        this.topToggleReflectionBtn = document.getElementById('top-toggle-reflection-btn');
        this.topTogglePlaceholdersBtn = document.getElementById('top-toggle-placeholders-btn');
        this.reflectionPanel = document.getElementById('reflection-panel');
        this.reflectionPanelTitle = document.getElementById('reflection-panel-title');
        this.reflectionPanelBody = document.getElementById('reflection-panel-body');
        this.reflectionPanelClose = document.getElementById('reflection-panel-close');
        this.reflectionPanelBackBtn = document.getElementById('reflection-panel-back-btn');
        this.reflectionPanelResizeHandle = document.getElementById('reflection-panel-resize-handle');
        this.resetViewBtn = document.getElementById('reset-view');
        this.orientationBtn = document.getElementById('orientation-btn');
        this.hamburgerOrientationBtn = document.getElementById('hamburger-orientation');

        // Layout arrangement (centered vs indented-list). This is a display preference,
        // not part of any individual chart's data, so it lives in localStorage and stays
        // the same across every chart and across browser sessions.
        this.arrangementBtn = document.getElementById('arrangement-btn');
        this.hamburgerArrangementBtn = document.getElementById('hamburger-arrangement');
        this.arrangement = localStorage.getItem('flowchart-arrangement') === 'indented' ? 'indented' : 'centered';
        this.undoBtn = document.getElementById('undo-btn');
        this.redoBtn = document.getElementById('redo-btn');
        this.exportBtn = document.getElementById('export-btn');
        this.importBtn = document.getElementById('import-btn');
        this.exportPopup = document.getElementById('export-popup');
        this.exportTextarea = document.getElementById('export-textarea');
        this.closeExportBtn = document.getElementById('close-export-btn');
        this.importPopup = document.getElementById('import-popup');
        this.importTextarea = document.getElementById('import-textarea');
        this.importConfirmBtn = document.getElementById('import-confirm-btn');
        this.closeImportBtn = document.getElementById('close-import-btn');
        this.openBtn = document.getElementById('open-btn');
        this.storagePopup = document.getElementById('storage-popup');
        this.storageSlots = document.getElementById('storage-slots');
        this.closeStorageBtn = document.getElementById('close-storage-btn');
        this.newFlowchartBtn = document.getElementById('new-flowchart-btn');

        // Show/hide non-root placeholder ("add new") nodes
        this.showPlaceholders = true;
        this.togglePlaceholdersBtn = document.getElementById('toggle-placeholders-btn');
        this.hamburgerTogglePlaceholdersBtn = document.getElementById('hamburger-toggle-placeholders');

        // AI Export/Import
        this.aiExportBtn = document.getElementById('ai-export-btn');
        this.aiImportBtn = document.getElementById('ai-import-btn');

        // Cloud Sync (JSONBin.io) - free key/value JSON storage, no login flow. The
        // whole flowchart list is stored as one bin; last-write-wins by timestamp.
        this.cloudSyncBtn = document.getElementById('cloud-sync-btn');
        this.topCloudSyncBtn = document.getElementById('top-cloud-sync-btn');
        this.cloudSyncPopup = document.getElementById('cloud-sync-popup');
        this.cloudSyncKeyInput = document.getElementById('cloud-sync-key-input');
        this.cloudSyncBinInput = document.getElementById('cloud-sync-bin-input');
        this.cloudSyncCreateBinBtn = document.getElementById('cloud-sync-create-bin-btn');
        this.cloudSyncSaveBtn = document.getElementById('cloud-sync-save-btn');
        this.cloudSyncDisconnectBtn = document.getElementById('cloud-sync-disconnect-btn');
        this.closeCloudSyncBtn = document.getElementById('close-cloud-sync-btn');
        this.cloudSyncPopupStatus = document.getElementById('cloud-sync-popup-status');
        this.cloudSyncStatusBadge = document.getElementById('cloud-sync-status');
        this.cloudMasterKey = localStorage.getItem('cloud-sync-master-key') || '';
        this.cloudBinId = localStorage.getItem('cloud-sync-bin-id') || '';
        this._cloudPushTimer = null;
        this._cloudPollTimer = null;
        this._cloudSyncInFlight = false;
        this._applyingRemote = false;
        this.setupCloudSync();

        this.selectedConnection = null;
        this.connectionMoveStep = 10;
        this.connectionControlsRow = document.getElementById('connection-controls-row');
        this.connectionControls = document.getElementById('connection-controls');
        this.moveLeftBtn = document.getElementById('move-connection-left');
        this.moveRightBtn = document.getElementById('move-connection-right');
        this.deleteConnectionBtn = document.getElementById('delete-connection-btn');
        this.nodeControlsRow = document.getElementById('node-controls-row');
        this.deleteNodeBtn = document.getElementById('delete-node-btn');

        // Zoom/pan variables
        this.transform = d3.zoomIdentity;

        // Tracks whether a pan/zoom gesture on the chart is currently in progress.
        // Capture-phase so it fires before the browser's native "blur the focused input"
        // default action for a mousedown/touchstart elsewhere on the page - this lets
        // the node-edit textarea's blur handler reliably tell whether it's being blurred
        // because of a pan gesture (and should defer its render) versus some other
        // reason (and can render immediately).
        this._gestureActive = false;
        const markGestureActive = (e) => {
            if (this.flowchartContainer && this.flowchartContainer.contains(e.target)) {
                this._gestureActive = true;
            }
        };
        const markGestureInactive = () => {
            this._gestureActive = false;
            if (this._deferredRenderPending) {
                this._deferredRenderPending = false;
                try {
                    this.renderFlowchart(this.rootData);
                } catch (err) {
                    console.error('Error flushing deferred render:', err);
                }
            }
        };
        document.addEventListener('mousedown', markGestureActive, true);
        document.addEventListener('touchstart', markGestureActive, true);
        document.addEventListener('mouseup', markGestureInactive, true);
        document.addEventListener('touchend', markGestureInactive, true);
        document.addEventListener('touchcancel', markGestureInactive, true);

        // Reflection panel: guided questions shown for Assumption (pink, #e75480) and
        // Simplify (green, #00a67e) nodes. Answers are stored per-node in
        // node.data._reflectionAnswers and persisted like any other node field.
        this.ASSUMPTION_QUESTIONS = [
            'What problem am I actually trying to solve?',
            'If this assumption was true is it really a problem needing to be solved? What would be the worst case scenario if I kept it?',
            'What evidence do I have that this is true? Is it evidence or interpretation?',
            'What is externally attached to this component or affecting this component? Can I alter that to solve the assumption?',
            'What constraints have I imposed with this assumption?',
            'What alternatives might I be overlooking?'
        ];
        this.SIMPLIFY_QUESTIONS = [
            'Is there anything I can remove to make this simpler?',
            'What alternatives could be simpler than this design?'
        ];
        this._reflectionNodeData = null;
        this._reflectionQuestions = null;
        this._reflectionPanelActive = false;
        this._reflectionPanelWidth = parseInt(localStorage.getItem('reflection-panel-width'), 10) || 340;
        this.setupReflectionPanel();

        this.orientation = 'TB';
        this.lrNodeSpacing = 150;
        this.tbNodeSpacing = 150;
        this.tbHorizontalSpacing = 150;
        this.tbVerticalSpacing = 160;
        this.minZoom = 0.1;
        this.maxZoom = 5;
        this.zoomStep = 0.2;
        this.currentZoom = null;

        // Context menu
        this.contextMenu = null;

        // Moving node state
        this.isMovingNode = false;
        this.movingNodeDatum = null;
        this.movingNodeAncestors = null;

        // Ctrl+drag reparent state
        this.ctrlDragState = null;
        this.skipNextNodeClick = false;

        // Making connection state
        this.isMakingConnection = false;
        this.connectionSourceNode = null;

        // Custom connections storage
        this.customConnections = [];

        // Undo/redo stacks
        this.undoStack = [];
        this.redoStack = [];

        // Node edit popup elements
        this.nodeEditPopup = document.getElementById('node-edit-popup');
        this.nodeEditInput = document.getElementById('node-edit-input');
        this.nodeEditForm = document.getElementById('node-edit-form');
        this.nodeBeingEdited = null;

        // Current active flowchart index
        this.currentSlotIndex = null;
        this.flowchartList = [];
        this.loadFlowchartList();

        // Set up event listeners
        if (this.topUndoBtn) this.topUndoBtn.addEventListener('click', () => this.undo());
        if (this.topRedoBtn) this.topRedoBtn.addEventListener('click', () => this.redo());
        if (this.topOpenBtn) this.topOpenBtn.addEventListener('click', () => this.showStoragePopup());
        if (this.topTogglePlaceholdersBtn) this.topTogglePlaceholdersBtn.addEventListener('click', () => this.togglePlaceholders());
        this.resetViewBtn.addEventListener('click', () => this.resetView());
        this.orientationBtn.addEventListener('click', () => this.toggleOrientation());
        this.hamburgerOrientationBtn.addEventListener('click', () => this.toggleOrientation());
        if (this.arrangementBtn) {
            this.arrangementBtn.addEventListener('click', () => this.toggleArrangement());
        }
        if (this.hamburgerArrangementBtn) {
            this.hamburgerArrangementBtn.addEventListener('click', () => this.toggleArrangement());
        }
        this.undoBtn.addEventListener('click', () => this.undo());
        this.redoBtn.addEventListener('click', () => this.redo());
        this.exportBtn.addEventListener('click', () => this.showExportPopup());
        this.closeExportBtn.addEventListener('click', () => this.exportPopup.style.display = 'none');
        this.importBtn.addEventListener('click', () => this.showImportPopup());
        this.closeImportBtn.addEventListener('click', () => this.importPopup.style.display = 'none');
        this.importConfirmBtn.addEventListener('click', () => this.importFromText());
        this.openBtn.addEventListener('click', () => this.showStoragePopup());
        this.closeStorageBtn.addEventListener('click', () => this.storagePopup.style.display = 'none');
        this.newFlowchartBtn.addEventListener('click', () => this.createNewFlowchart());
        if (this.togglePlaceholdersBtn) {
            this.togglePlaceholdersBtn.addEventListener('click', () => this.togglePlaceholders());
        }
        if (this.hamburgerTogglePlaceholdersBtn) {
            this.hamburgerTogglePlaceholdersBtn.addEventListener('click', () => this.togglePlaceholders());
        }

        // Cloud Sync event listeners
        if (this.cloudSyncBtn) this.cloudSyncBtn.addEventListener('click', () => this.showCloudSyncPopup());
        if (this.topCloudSyncBtn) this.topCloudSyncBtn.addEventListener('click', () => this.showCloudSyncPopup());
        if (this.closeCloudSyncBtn) this.closeCloudSyncBtn.addEventListener('click', () => this.cloudSyncPopup.style.display = 'none');
        if (this.cloudSyncSaveBtn) this.cloudSyncSaveBtn.addEventListener('click', () => this.saveCloudSyncSettings());
        if (this.cloudSyncCreateBinBtn) this.cloudSyncCreateBinBtn.addEventListener('click', () => this.createCloudBin());
        if (this.cloudSyncDisconnectBtn) this.cloudSyncDisconnectBtn.addEventListener('click', () => this.disconnectCloudSync());

        // AI Export/Import event listeners
        this.aiExportBtn.addEventListener('click', () => this.exportToAi());
        this.aiImportBtn.addEventListener('click', () => this.importFromAi());

        // Node edit popup handlers
        this.nodeEditForm.addEventListener('submit', (e) => {
            e.preventDefault();
            // Do nothing on enter, let blur or background click handle save
        });

        // Save on every keystroke in the node name input
        this.nodeEditInput.addEventListener('input', () => {
            if (this.nodeBeingEdited) {
                this._pendingNodeSave = true;
            }
            this.resizeNodeEditInput();
        });

        // Save on blur (clicking away from the input). If a pan/zoom gesture is
        // currently in progress, defer the render just like the zoom behavior's own
        // 'start' handler does - a full render mid-gesture breaks the gesture's pointer
        // tracking. Whichever of the two (this blur handler or the zoom 'start' handler)
        // fires first does the save; nodeBeingEdited is null by the time the other runs,
        // so there's no double-save.
        this.nodeEditInput.addEventListener('blur', () => {
            if (this._pendingNodeSave && this.nodeBeingEdited) {
                this._pendingNodeSave = false;
                try {
                    this.saveNodeEdit(this._gestureActive);
                } catch (err) {
                    console.error('Error saving node edit on blur:', err);
                }
            }
        });

        // The edit field is a wrapping textarea now (so long names wrap at the popup's
        // width instead of overflowing); Enter still commits/blurs rather than adding a
        // newline, matching how the old single-line input behaved.
        this.nodeEditInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.nodeEditInput.blur();
            }
        });

        // On first ever load seed with sample data; otherwise restore the last opened flowchart
        if (this.flowchartList.length > 0) {
            const initialIndex = this.getPreferredFlowchartIndex();
            this.loadFlowchartFromList(initialIndex);
        } else {
            this.renderFlowchart(this.getSampleData(), { fitView: true });
            this.currentSlotIndex = 0;
            this.saveCurrentFlowchart();
        }

        this.updateOrientationButtonLabels();
        this.updateTogglePlaceholdersLabels();
        this.updateArrangementButtonLabels();
        this.applyMobileViewState();

        // Re-render on real window resizes and orientation changes so the SVG's
        // viewBox/width/height actually track the container's new size - otherwise the
        // chart stays pinned to whatever size it was first drawn at, leaving a stale
        // border/gap once the window or device orientation actually changes.
        let resizeRenderTimer = null;
        let lastRenderWidth = window.innerWidth;
        const rerenderForResize = () => {
            if (this.rootData) {
                this.renderFlowchart(this.rootData);
            }
            if (this.nodeBeingEdited) {
                this.positionNodeEditPopupForMobile();
            }
        };
        window.addEventListener('resize', () => {
            // Ignore height-only changes (e.g. the on-screen keyboard opening/closing);
            // only width changes indicate an actual window resize or orientation change.
            const widthChanged = window.innerWidth !== lastRenderWidth;
            if (!widthChanged && window.visualViewport) return;
            lastRenderWidth = window.innerWidth;
            clearTimeout(resizeRenderTimer);
            resizeRenderTimer = setTimeout(rerenderForResize, 150);
        });
        window.addEventListener('orientationchange', () => {
            lastRenderWidth = window.innerWidth;
            clearTimeout(resizeRenderTimer);
            resizeRenderTimer = setTimeout(rerenderForResize, 250);
        });

        // Keyboard shortcuts for undo/redo and delete
        document.addEventListener('keydown', (e) => {
            // Handle Delete key always (even when an input is focused) to remove selected node
            if (e.key === 'Delete' || e.key === 'Del') {
                if (this.selectedNode) {
                    e.preventDefault();
                    this.deleteNode(this.selectedNode);
                    this.deselectNode();
                }
                return;
            }

            // Escape closes the node edit popup (even while the text input is focused).
            if (e.key === 'Escape' || e.key === 'Esc') {
                if (this.nodeBeingEdited) {
                    e.preventDefault();
                    this.hideNodeEditPopup(true);
                }
                return;
            }

            // Ignore other shortcuts if focus is in an input or textarea
            const tag = document.activeElement.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA') return;

            if (e.ctrlKey && !e.shiftKey && (e.key === 'z' || e.key === 'Z')) {
                e.preventDefault();
                this.undo();
            } else if (e.ctrlKey && e.shiftKey && (e.key === 'z' || e.key === 'Z')) {
                e.preventDefault();
                this.redo();
            }
        });

        // Add event listeners for connection move buttons
        this.moveLeftBtn.addEventListener('click', () => this.moveSelectedConnection(-this.connectionMoveStep));
        this.moveRightBtn.addEventListener('click', () => this.moveSelectedConnection(this.connectionMoveStep));
        this.deleteConnectionBtn.addEventListener('click', () => this.deleteSelectedConnection());
    }

    // Load flowchart list from localStorage
    loadFlowchartList() {
        const saved = localStorage.getItem('flowchart-list');
        if (saved) {
            try {
                this.flowchartList = JSON.parse(saved);
                // Ensure each entry has a title and data
                this.flowchartList = this.flowchartList.filter(item => item && item.data);
            } catch (e) {
                this.flowchartList = [];
            }
        } else {
            this.flowchartList = [];
        }
    }

    // Save flowchart list to localStorage
    saveFlowchartList() {
        localStorage.setItem('flowchart-list', JSON.stringify(this.flowchartList));
    }

    getPreferredFlowchartIndex() {
        if (!Array.isArray(this.flowchartList) || this.flowchartList.length === 0) {
            return 0;
        }

        const savedIndex = Number(localStorage.getItem('flowchart-last-index'));
        if (Number.isInteger(savedIndex) && savedIndex >= 0 && savedIndex < this.flowchartList.length) {
            return savedIndex;
        }

        return 0;
    }

    saveActiveFlowchartIndex() {
        if (this.currentSlotIndex !== null && this.currentSlotIndex >= 0) {
            localStorage.setItem('flowchart-last-index', String(this.currentSlotIndex));
        }
    }

    // Save current flowchart to the list
    saveCurrentFlowchart() {
        // Recover from null index if we have a list
        if (this.currentSlotIndex === null) {
            if (this.flowchartList.length > 0) {
                this.currentSlotIndex = this.flowchartList.length - 1;
            } else {
                return;
            }
        }
        const data = this.exportAsJSON();
        if (this.currentSlotIndex < this.flowchartList.length) {
            this.flowchartList[this.currentSlotIndex].data = data;
        } else {
            // If index is out of bounds, add a new entry
            this.flowchartList.push({
                title: `Flowchart ${this.flowchartList.length + 1}`,
                data: data
            });
            this.currentSlotIndex = this.flowchartList.length - 1;
        }
        this.saveFlowchartList();
        this.saveActiveFlowchartIndex();
    }

    // Autosave wrapper - call after any edit
    autosave() {
        this.saveCurrentFlowchart();
        if (!this._applyingRemote) this.scheduleCloudPush();
    }

    // ===== CLOUD SYNC (GitHub Gist) =====
    // Free, no login flow for the app itself (just a personal access token pasted
    // once), and no small fixed request-size cap like JSONBin's 100KB - gist files
    // hold up to 1MB before the API truncates them, which the whole saved flowchart
    // list will realistically never approach. Last-write-wins by timestamp.
    setupCloudSync() {
        this.CLOUD_GIST_FILENAME = 'flowchart-cloud-sync.json';
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && this.cloudMasterKey && this.cloudBinId) this.cloudPull();
        });
        if (this.cloudMasterKey && this.cloudBinId) {
            this.updateCloudSyncStatus('idle');
            this.startCloudPolling();
            // Pick up anything saved from another device shortly after boot.
            setTimeout(() => this.cloudPull(), 800);
        }
    }

    startCloudPolling() {
        clearInterval(this._cloudPollTimer);
        this._cloudPollTimer = setInterval(() => {
            if (!document.hidden) this.cloudPull();
        }, 8000);
    }

    scheduleCloudPush() {
        if (!this.cloudMasterKey || !this.cloudBinId) return;
        clearTimeout(this._cloudPushTimer);
        this._cloudPushTimer = setTimeout(() => this.cloudPush(), 2000);
    }

    setCloudPopupStatus(text, isError = false) {
        if (!this.cloudSyncPopupStatus) return;
        this.cloudSyncPopupStatus.textContent = text || '';
        this.cloudSyncPopupStatus.style.color = isError ? '#a00' : '#0a0';
    }

    updateCloudSyncStatus(state, message) {
        const badge = this.cloudSyncStatusBadge;
        if (!badge) return;
        if (!this.cloudMasterKey || !this.cloudBinId) {
            badge.style.display = 'none';
            return;
        }
        badge.style.display = 'block';
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        if (state === 'syncing') badge.textContent = '☁ Syncing...';
        else if (state === 'synced') badge.textContent = `☁ Synced ${time}`;
        else if (state === 'error') badge.textContent = `☁ Sync error${message ? ': ' + message : ''}`;
        else badge.textContent = '☁ Cloud sync on';
    }

    showCloudSyncPopup() {
        if (!this.cloudSyncPopup) return;
        this.cloudSyncKeyInput.value = this.cloudMasterKey || '';
        this.cloudSyncBinInput.value = this.cloudBinId || '';
        this.setCloudPopupStatus(this.cloudMasterKey && this.cloudBinId ? 'Connected.' : '');
        this.cloudSyncPopup.style.display = 'block';
    }

    saveCloudSyncSettings() {
        const token = (this.cloudSyncKeyInput.value || '').trim();
        const gistId = (this.cloudSyncBinInput.value || '').trim();
        if (!token || !gistId) {
            this.setCloudPopupStatus('Enter both a token and a Gist ID (or click "Create New Gist").', true);
            return;
        }
        this.cloudMasterKey = token;
        this.cloudBinId = gistId;
        localStorage.setItem('cloud-sync-master-key', token);
        localStorage.setItem('cloud-sync-bin-id', gistId);
        this.setCloudPopupStatus('Connected. Syncing...');
        this.startCloudPolling();
        this.cloudPull().then(() => this.cloudPush());
    }

    disconnectCloudSync() {
        this.cloudMasterKey = '';
        this.cloudBinId = '';
        localStorage.removeItem('cloud-sync-master-key');
        localStorage.removeItem('cloud-sync-bin-id');
        localStorage.removeItem('cloud-sync-known-remote-at');
        clearTimeout(this._cloudPushTimer);
        clearInterval(this._cloudPollTimer);
        this._cloudPollTimer = null;
        if (this.cloudSyncKeyInput) this.cloudSyncKeyInput.value = '';
        if (this.cloudSyncBinInput) this.cloudSyncBinInput.value = '';
        this.setCloudPopupStatus('Disconnected.');
        this.updateCloudSyncStatus('idle');
    }

    async createCloudBin() {
        const token = (this.cloudSyncKeyInput.value || '').trim();
        if (!token) {
            this.setCloudPopupStatus('Paste your Personal Access Token first.', true);
            return;
        }
        this.setCloudPopupStatus('Creating gist...');
        try {
            const updatedAt = Date.now();
            const payload = JSON.stringify({ updatedAt, flowchartList: this.flowchartList });
            const res = await fetch('https://api.github.com/gists', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/vnd.github+json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    description: 'Flowchart Editor cloud sync data',
                    public: false,
                    files: { [this.CLOUD_GIST_FILENAME]: { content: payload } }
                })
            });
            if (!res.ok) throw new Error(`GitHub API error ${res.status}`);
            const gist = await res.json();
            this.cloudSyncBinInput.value = gist.id;
            this.setCloudPopupStatus('Gist created! Click "Save & Sync Now" to connect.');
        } catch (err) {
            console.error('Create gist failed:', err);
            this.setCloudPopupStatus('Failed to create gist: ' + err.message, true);
        }
    }

    async cloudPush() {
        if (!this.cloudMasterKey || !this.cloudBinId) return;
        if (this._cloudSyncInFlight) {
            this._cloudPushTimer = setTimeout(() => this.cloudPush(), 1500);
            return;
        }
        this._cloudSyncInFlight = true;
        this.updateCloudSyncStatus('syncing');
        try {
            const updatedAt = Date.now();
            const payload = JSON.stringify({ updatedAt, flowchartList: this.flowchartList });
            // Gist files truncate past 1MB via the API - bail out with a clear warning
            // well before that instead of silently losing data.
            if (payload.length > 900000) {
                this.updateCloudSyncStatus('error', 'data too large (>900KB) - remove some old flowcharts');
                this._cloudSyncInFlight = false;
                return;
            }
            const res = await fetch(`https://api.github.com/gists/${this.cloudBinId}`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${this.cloudMasterKey}`,
                    'Accept': 'application/vnd.github+json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    files: { [this.CLOUD_GIST_FILENAME]: { content: payload } }
                })
            });
            if (!res.ok) throw new Error(`GitHub API error ${res.status}`);
            localStorage.setItem('cloud-sync-known-remote-at', String(updatedAt));
            this.updateCloudSyncStatus('synced');
        } catch (err) {
            console.error('Cloud push failed:', err);
            this.updateCloudSyncStatus('error', err.message);
        } finally {
            this._cloudSyncInFlight = false;
        }
    }

    async cloudPull() {
        if (!this.cloudMasterKey || !this.cloudBinId) return;
        if (this._cloudSyncInFlight) return;
        this._cloudSyncInFlight = true;
        try {
            const res = await fetch(`https://api.github.com/gists/${this.cloudBinId}`, {
                headers: {
                    'Authorization': `Bearer ${this.cloudMasterKey}`,
                    'Accept': 'application/vnd.github+json'
                }
            });
            if (!res.ok) throw new Error(`GitHub API error ${res.status}`);
            const gist = await res.json();
            const file = gist.files && gist.files[this.CLOUD_GIST_FILENAME];
            if (!file) throw new Error('sync file not found in gist');
            let content = file.content;
            if (file.truncated && file.raw_url) {
                const rawRes = await fetch(file.raw_url);
                content = await rawRes.text();
            }
            const parsed = JSON.parse(content);
            const remoteUpdatedAt = Number(parsed.updatedAt) || 0;
            const knownRemoteAt = Number(localStorage.getItem('cloud-sync-known-remote-at')) || 0;
            if (remoteUpdatedAt > knownRemoteAt && Array.isArray(parsed.flowchartList)) {
                this._applyingRemote = true;
                this.flowchartList = parsed.flowchartList;
                this.saveFlowchartList();
                localStorage.setItem('cloud-sync-known-remote-at', String(remoteUpdatedAt));
                if (this.currentSlotIndex === null || this.currentSlotIndex >= this.flowchartList.length) {
                    this.currentSlotIndex = 0;
                }
                this.loadFlowchartFromList(this.currentSlotIndex);
                this._applyingRemote = false;
                this.showNotification('Synced latest changes from another device.');
            }
            this.updateCloudSyncStatus('synced');
        } catch (err) {
            console.error('Cloud pull failed:', err);
            this.updateCloudSyncStatus('error', err.message);
        } finally {
            this._cloudSyncInFlight = false;
        }
    }

    // Helper methods for leaf node and green node detection
    isLeafNode(node) {
        // A node is a leaf if it has no children AND no outgoing custom connections
        const hasChildren = node.children && node.children.length > 0;
        const hasOutgoingConnections = this.customConnections.some(conn => conn.source === node.data);
        return !hasChildren && !hasOutgoingConnections;
    }

    isGreenNode(node) {
        return node.data.color === '#00a67e';
    }

    hasVisibleChildren(node) {
        return Boolean(
            node.data.children &&
            node.data.children.some(child => !this.isPlaceholderNodeData(child) && (child.name || '').trim())
        );
    }

    toggleNodeCollapse(d, keepSelection = false) {
        if (!d || !d.data || !d.data.children || d.data.children.length === 0) return;
        this.pushUndo();
        const nodeData = d.data;
        nodeData._collapsed = !Boolean(nodeData._collapsed);
        if (keepSelection) {
            // Used by the radial "F" button: re-render, then re-find and re-select the
            // same node (its d3.hierarchy wrapper is a new object after every render)
            // so the radial menu stays open and can be toggled again immediately,
            // instead of silently disappearing after one use.
            this.renderFlowchart(this.rootData);
            let found = null;
            d3.hierarchy(this.rootData).each(node => {
                if (node.data === nodeData) found = node;
            });
            this.selectedNode = found || null;
            this.refreshRadialButtons();
        } else {
            // Hide the radial add-buttons after a fold/unfold; they only reappear if the
            // node is clicked again.
            this.selectedNode = null;
            this.renderFlowchart(this.rootData);
        }
        this.autosave();
    }

    // Update all leaf node names with "(Simplify?)" suffix if they're green
    updateSimplifyPrefixes(node) {
        if (!node) return;
        
        // Check if this is a green leaf node
        if (this.isGreenNode(node) && this.isLeafNode(node)) {
            // Add "(Simplify?)" suffix if not already present
            if (!node.data.name.endsWith(' (Simplify?)')) {
                node.data.name = node.data.name + ' (Simplify?)';
            }
        } else {
            // Remove "(Simplify?)" suffix if it exists and node is no longer a green leaf
            if (node.data.name.endsWith(' (Simplify?)')) {
                node.data.name = node.data.name.substring(0, node.data.name.length - ' (Simplify?)'.length);
            }
        }
        
        // Recursively process children
        if (node.children) {
            node.children.forEach(child => {
                this.updateSimplifyPrefixes(child);
            });
        }
    }

    showStoragePopup() {
        this.loadFlowchartList();
        this.storageSlots.innerHTML = '';
        
        // Display existing flowcharts
        if (this.flowchartList.length === 0) {
            const emptyMsg = document.createElement('div');
            emptyMsg.textContent = 'No flowcharts saved. Click "New Flowchart" to create one.';
            emptyMsg.style.padding = '20px';
            emptyMsg.style.textAlign = 'center';
            emptyMsg.style.color = '#9aa6b2';
            this.storageSlots.appendChild(emptyMsg);
        } else {
            this.flowchartList.forEach((item, index) => {
                const slot = document.createElement('div');
                slot.className = 'storage-slot';
                if (index === this.currentSlotIndex) {
                    slot.classList.add('active-slot');
                }
                
                const titleSpan = document.createElement('span');
                titleSpan.textContent = item.title || `Flowchart ${index + 1}`;
                titleSpan.style.flex = '1';
                titleSpan.style.padding = '4px 8px';
                
                const selectBtn = document.createElement('button');
                selectBtn.textContent = 'Select';
                selectBtn.style.padding = '4px 12px';
                selectBtn.style.background = '#e0f0ff';
                selectBtn.style.border = '1px solid #aaa';
                selectBtn.style.borderRadius = '4px';
                selectBtn.style.cursor = 'pointer';
                
                selectBtn.onclick = () => {
                    this.loadFlowchartFromList(index);
                    this.storagePopup.style.display = 'none';
                };
                
                const renameBtn = document.createElement('button');
                renameBtn.textContent = 'Rename';
                renameBtn.style.padding = '4px 12px';
                renameBtn.style.background = '#fff0d0';
                renameBtn.style.border = '1px solid #aaa';
                renameBtn.style.borderRadius = '4px';
                renameBtn.style.cursor = 'pointer';
                
                renameBtn.onclick = () => {
                    const newTitle = prompt('Enter new name:', titleSpan.textContent);
                    if (newTitle && newTitle.trim()) {
                        this.flowchartList[index].title = newTitle.trim();
                        this.saveFlowchartList();
                        this.showStoragePopup();
                    }
                };
                
                const deleteBtn = document.createElement('button');
                deleteBtn.textContent = 'Delete';
                deleteBtn.style.padding = '4px 12px';
                deleteBtn.style.background = '#ffe0e0';
                deleteBtn.style.border = '1px solid #ffaaaa';
                deleteBtn.style.borderRadius = '4px';
                deleteBtn.style.cursor = 'pointer';
                
                deleteBtn.onclick = () => {
                    if (confirm(`Delete "${titleSpan.textContent}"?`)) {
                        this.flowchartList.splice(index, 1);
                        if (this.currentSlotIndex === index) {
                            this.currentSlotIndex = null;
                        } else if (this.currentSlotIndex > index) {
                            this.currentSlotIndex--;
                        }
                        this.saveFlowchartList();
                        this.showStoragePopup();
                        if (this.flowchartList.length === 0) {
                            this.renderFlowchart(this.getSampleData());
                            this.currentSlotIndex = 0;
                            this.saveCurrentFlowchart();
                        } else if (this.currentSlotIndex === null) {
                            this.loadFlowchartFromList(0);
                        }
                    }
                };
                
                slot.appendChild(titleSpan);
                slot.appendChild(selectBtn);
                slot.appendChild(renameBtn);
                slot.appendChild(deleteBtn);
                this.storageSlots.appendChild(slot);
            });
        }
        
        this.storagePopup.style.display = 'block';
    }
    
    createNewFlowchart() {
        if (this.currentSlotIndex !== null && this.flowchartList[this.currentSlotIndex]) {
            this.saveCurrentFlowchart();
        }
        this.resetReflectionState();

        const defaultData = {
            name: "New Flowchart",
            color: '#00a67e',
            children: [
                { name: "Start", color: '#00a67e' }
            ]
        };
        
        this.flowchartList.push({
            title: `Flowchart ${this.flowchartList.length + 1}`,
            data: JSON.stringify({
                tree: defaultData,
                customConnections: [],
                orientation: 'TB',
                showPlaceholders: true
            })
        });
        
        this.currentSlotIndex = this.flowchartList.length - 1;
        this.saveFlowchartList();
        
        if (this.currentSlotIndex !== null && this.flowchartList[this.currentSlotIndex]) {
            this.saveCurrentFlowchart();
        }
        
        this.customConnections = [];
        this.rootData = defaultData;
        this.orientation = 'TB';
        this.showPlaceholders = true;
        this.transform = d3.zoomIdentity;
        this._zoomBehavior = null;
        this.updateOrientationButtonLabels();
        this.updateTogglePlaceholdersLabels();
        
        this.renderFlowchart(this.rootData);
        this.currentSlotIndex = this.flowchartList.length - 1;
        this.saveCurrentFlowchart();
        
        this.storagePopup.style.display = 'none';
        this.showNotification('New flowchart created!');
    }
    
    loadFlowchartFromList(index) {
        if (index >= this.flowchartList.length) return;
        
        if (this.rootData && this.currentSlotIndex !== null && this.flowchartList[this.currentSlotIndex]) {
            this.saveCurrentFlowchart();
        }
        
        const item = this.flowchartList[index];
        if (!item || !item.data) return;
        
        this.resetReflectionState();
        try {
            const parsed = JSON.parse(item.data);
            if (parsed.tree) {
                if (this.rootData) this.pushUndo();
                this.orientation = parsed.orientation || 'TB';
                this.showPlaceholders = parsed.showPlaceholders !== false;
                this.updateTogglePlaceholdersLabels();
                const savedTransform = parsed.transform;
                const hasSavedTransform = savedTransform &&
                    typeof savedTransform.x === 'number' &&
                    typeof savedTransform.y === 'number' &&
                    typeof savedTransform.k === 'number';
                this.transform = hasSavedTransform
                    ? d3.zoomIdentity.translate(savedTransform.x, savedTransform.y).scale(savedTransform.k)
                    : d3.zoomIdentity;
                const renderOpts = hasSavedTransform ? { keepTransform: true } : { fitView: true };
                this._zoomBehavior = null;
                this.updateOrientationButtonLabels();
                
                let treeData = parsed.tree;
                if (this.isPlaceholderNodeData(treeData) || 
                    (treeData.name === '' && treeData.color === this.getPlaceholderColor() && treeData.children && treeData.children.length > 0)) {
                    this.rootData = treeData;
                } else {
                    this.rootData = this.wrapRootWithPlaceholder(treeData);
                    this.ensureRightmostPlaceholderNodes(this.rootData);
                }
                
                if (parsed.customConnections) {
                    const nodeMap = new Map();
                    d3.hierarchy(this.rootData).each(d => nodeMap.set(d.data.name, d.data));
                    
                    this.customConnections = parsed.customConnections
                        .map(conn => {
                            const source = nodeMap.get(conn.source);
                            const target = nodeMap.get(conn.target);
                            if (source && target) {
                                return {
                                    source,
                                    target,
                                    _offset: conn._offset || 0
                                };
                            }
                            return null;
                        })
                        .filter(Boolean);
                    
                    this.renderFlowchart(this.rootData, renderOpts);
                }
                
                this.renderFlowchart(this.rootData, renderOpts);
                this.currentSlotIndex = index;
                this.saveCurrentFlowchart();
                this.autosave();
            }
        } catch (e) {
            console.error('Error loading saved flowchart:', e);
            alert('Failed to load saved flowchart');
        }
    }

    getSampleData() {
        return {
            name: "Root",
            children: [
                {
                    name: "Node A",
                    children: [
                        { name: "Node A1" },
                        { name: "Node A2" }
                    ]
                },
                {
                    name: "Node B",
                    children: [
                        { name: "Node B1" },
                        { name: "Node B2" }
                    ]
                }
            ]
        };
    }

    setupZoom(svg, g) {
        if (!this._zoomBehavior) {
            this._zoomBehavior = d3.zoom()
                .scaleExtent([this.minZoom, this.maxZoom])
                .clickDistance(10)
                .on('start', (event) => {
                    // Real user gesture starting to pan/zoom while a node's text is being
                    // edited: save that edit instead of discarding it. Only fires once per
                    // gesture, before any 'zoom' ticks. The render is deferred (see below)
                    // so the SVG isn't torn down and rebuilt while this same gesture is
                    // still actively tracking - doing that mid-drag broke d3-zoom's pointer
                    // state and made the *next* pan jump. Wrapped in try/catch since an
                    // uncaught exception here would abort d3-zoom's own gesture setup
                    // partway through, freezing the drag entirely rather than just this save.
                    if (event.sourceEvent && this.nodeBeingEdited && !this._suppressPopupHide) {
                        try {
                            this.hideNodeEditPopup(true, true);
                        } catch (err) {
                            console.error('Error saving node edit at gesture start:', err);
                        }
                    }
                })
                .on('zoom', (event) => {
                    this.transform = event.transform;
                    const flowGroup = d3.select('#flowchart g').node();
                    if (flowGroup) {
                        d3.select(flowGroup).attr('transform', this.transform);
                    }
                    this.hideContextMenu();
                    // Dragging/zooming the background hides the radial add-buttons too;
                    // they only come back if the node is clicked again. Gated to real user
                    // gestures (sourceEvent set) so our own programmatic transform calls -
                    // e.g. the mobile centering that now runs after the keyboard opens -
                    // don't immediately wipe out buttons that were just shown.
                    if (event.sourceEvent && this.selectedNode) {
                        this.selectedNode = null;
                        d3.selectAll('.radial-add-btn-layer').remove();
                    }
                })
                .on('end', (event) => {
                    // Only persist on a real user gesture (sourceEvent set) - our own
                    // programmatic transform calls (initial setup, mobile centering,
                    // restoring a saved view) also fire 'end' but shouldn't trigger a save.
                    if (event.sourceEvent) {
                        try {
                            this.autosave();
                        } catch (err) {
                            console.error('Error autosaving at gesture end:', err);
                        }
                    }
                    // Now that the gesture has fully finished, it's safe to flush any
                    // render that a mid-gesture text save deferred.
                    if (this._deferredRenderPending) {
                        this._deferredRenderPending = false;
                        try {
                            this.renderFlowchart(this.rootData);
                        } catch (err) {
                            console.error('Error flushing deferred render at gesture end:', err);
                        }
                    }
                });
        }

        svg.call(this._zoomBehavior);
        svg.call(this._zoomBehavior.transform, this.transform);

        svg.on('dblclick.zoom', null);

        svg.on('click', (event) => {
            if (event.target === svg.node()) {
                this.hideContextMenu();
                this.hideNodeEditPopup(true);
                this.deselectNode();
                if (this.isMovingNode) this.cancelMoveNode();
                if (this.isMakingConnection) this.cancelMakeConnection();
            }
        });
    }

    zoom(factor) {
        const svg = d3.select('#flowchart svg');
        if (!this._zoomBehavior || svg.empty()) return;
        const container = this.flowchartContainer.getBoundingClientRect();
        const cx = container.width / 2;
        const cy = container.height / 2;
        svg.call(this._zoomBehavior.scaleBy, factor, [cx, cy]);
    }

    resetZoom() {
        const svg = d3.select('#flowchart svg');
        if (!this._zoomBehavior || svg.empty()) return;
        svg.transition().duration(300)
            .call(this._zoomBehavior.scaleTo, 1);
    }

    // On mobile, tapping a node centers it horizontally and vertically in the middle of
    // the top half of the screen, and opens the keyboard via showNodeEditPopup's focus
    // call. This happens instantly, synchronously alongside opening the popup. Desktop
    // is unaffected.
    centerNodeOnMobile(d, callback) {
        const isMobile = window.matchMedia('(max-width: 600px)').matches;
        const svg = d3.select('#flowchart svg');
        if (!isMobile || !this._zoomBehavior || svg.empty() || !d ||
            !Number.isFinite(d.x) || !Number.isFinite(d.y)) {
            callback();
            return;
        }

        const width = this.flowchartPanel.clientWidth;
        const height = this.flowchartPanel.clientHeight;
        const k = this.transform.k;
        const tx = width / 2 - d.x * k;
        // Center of the top half of the screen: 1/4 of the height.
        const ty = (height * 0.25) - d.y * k;
        const newTransform = d3.zoomIdentity.translate(tx, ty).scale(k);
        svg.call(this._zoomBehavior.transform, newTransform);
        callback();
    }

    resetView() {
        this.transform = d3.zoomIdentity;
        this._zoomBehavior = null;
        this.updateFlowchart();
    }

    toggleOrientation() {
        this.orientation = this.orientation === 'LR' ? 'TB' : 'LR';
        this.updateOrientationButtonLabels();
        this.renderFlowchart(this.rootData);
        this.autosave();
    }

    updateOrientationButtonLabels() {
        const label = this.orientation === 'LR' ? '↔ Left-Right' : '↕ Top-Down';
        if (this.orientationBtn) this.orientationBtn.textContent = label;
        if (this.hamburgerOrientationBtn) this.hamburgerOrientationBtn.textContent = label;
    }

    toggleArrangement() {
        this.arrangement = this.arrangement === 'indented' ? 'centered' : 'indented';
        localStorage.setItem('flowchart-arrangement', this.arrangement);
        this.updateArrangementButtonLabels();
        this.renderFlowchart(this.rootData);
        this.autosave();
    }

    updateArrangementButtonLabels() {
        const label = this.arrangement === 'indented' ? '📐 Indented Layout' : '📐 Centered Layout';
        if (this.arrangementBtn) this.arrangementBtn.textContent = label;
        if (this.hamburgerArrangementBtn) this.hamburgerArrangementBtn.textContent = label;
    }

    // Positions a d3 hierarchy in "indented list" style instead of the default centered
    // tree: each node's first child continues straight along the depth axis (same
    // secondary-axis coordinate as its parent), and any additional siblings fan out
    // along the secondary axis starting from that first child, rather than being
    // centered as a group under the parent. Operates in the pre-LR-swap coordinate
    // frame (x = secondary/sibling-spread axis, y = primary/depth axis), same as
    // d3.tree(), so the existing LR swap that runs after layout still applies.
    //
    // Siblings are packed as tightly as possible rather than each reserving its full
    // subtree's bounding-box width: a sibling with no children, or whose descendants
    // never reach a row (depth) actually occupied by an earlier sibling's descendants,
    // is pulled in until it's just one spacing unit away from what's already placed -
    // it only backs off further where two subtrees would truly collide row-by-row.
    // This is done with a contour: for each node, node._contour[r] tracks the
    // min/max secondary-axis extent reached by its subtree r rows below itself.
    computeIndentedContour(node, secondarySpacing) {
        const children = node.children;
        if (!children || children.length === 0) {
            node._contour = [{ min: 0, max: 0 }];
            return node._contour;
        }

        children.forEach(child => this.computeIndentedContour(child, secondarySpacing));

        // Contour of everything placed under this node so far, in this node's own
        // local frame (this node sits at local x = 0).
        const combined = [];
        const mergeInto = (childContour, offset) => {
            childContour.forEach((c, row) => {
                if (!c) return;
                const parentRow = row + 1;
                const shifted = { min: c.min + offset, max: c.max + offset };
                if (!combined[parentRow]) {
                    combined[parentRow] = { min: shifted.min, max: shifted.max };
                } else {
                    combined[parentRow].min = Math.min(combined[parentRow].min, shifted.min);
                    combined[parentRow].max = Math.max(combined[parentRow].max, shifted.max);
                }
            });
        };

        // First child always continues flush with the parent (offset 0) - that's what
        // keeps the "first entry stays in line with its parent" look.
        children[0]._secondaryOffset = 0;
        mergeInto(children[0]._contour, 0);

        // Each later sibling is pulled in as close as it can get: only rows where its
        // own subtree would actually overlap something already placed push it further out.
        for (let i = 1; i < children.length; i++) {
            const child = children[i];
            const childContour = child._contour;
            let offset = 0;
            for (let row = 0; row < childContour.length; row++) {
                const c = childContour[row];
                if (!c) continue;
                const parentRow = row + 1;
                const existing = combined[parentRow];
                if (existing) {
                    const required = (existing.max + secondarySpacing) - c.min;
                    if (required > offset) offset = required;
                }
            }
            child._secondaryOffset = offset;
            mergeInto(childContour, offset);
        }

        const contour = [{ min: 0, max: 0 }];
        for (let row = 1; row < combined.length; row++) {
            contour[row] = combined[row];
        }
        node._contour = contour;
        return contour;
    }

    assignIndentedPositions(node, secondaryStart, depth, primarySpacing) {
        node.x = secondaryStart;
        node.y = depth * primarySpacing;
        (node.children || []).forEach(child => {
            this.assignIndentedPositions(child, secondaryStart + (child._secondaryOffset || 0), depth + 1, primarySpacing);
        });
    }

    applyIndentedLayout(root, secondarySpacing, primarySpacing) {
        this.computeIndentedContour(root, secondarySpacing);
        this.assignIndentedPositions(root, 0, 0, primarySpacing);
    }

    togglePlaceholders() {
        this.showPlaceholders = !this.showPlaceholders;
        this.updateTogglePlaceholdersLabels();
        this.renderFlowchart(this.rootData);
        this.autosave();
    }

    updateTogglePlaceholdersLabels() {
        const label = this.showPlaceholders ? '👻 Hide Placeholders' : '👻 Show Placeholders';
        if (this.togglePlaceholdersBtn) this.togglePlaceholdersBtn.textContent = label;
        if (this.hamburgerTogglePlaceholdersBtn) this.hamburgerTogglePlaceholdersBtn.textContent = label;
    }

    updateFlowchart() {
        this.renderFlowchart(this.rootData);
    }

    getNodeLevel(node) {
        let level = 0;
        while (node.parent) {
            level++;
            node = node.parent;
        }
        return level;
    }

    getPlaceholderColor() {
        return '#323a4a';
    }

    isPlaceholderNodeData(nodeData) {
        if (!nodeData) return false;
        return Boolean(nodeData._isPlaceholder);
    }

    markNodeAsReal(nodeData) {
        if (nodeData) {
            delete nodeData._isPlaceholder;
            if (nodeData.color === this.getPlaceholderColor()) {
                nodeData.color = '#00a67e';
            }
        }
    }

    createPlaceholderNode() {
        return {
            name: '',
            color: this.getPlaceholderColor(),
            _isPlaceholder: true
        };
    }

    wrapRootWithPlaceholder(data) {
        if (!data || typeof data !== 'object') return this.createPlaceholderNode();
        if (this.isPlaceholderNodeData(data)) return data;
        
        if (data.children && data.children.length > 0) {
            if (data.name === '' && data.color === this.getPlaceholderColor()) {
                const hasRealChild = data.children.some(child => !this.isPlaceholderNodeData(child));
                if (hasRealChild) {
                    return data;
                }
            }
        }
        
        return {
            ...this.createPlaceholderNode(),
            children: [data]
        };
    }

    isRootPlaceholderNode(node) {
        return Boolean(
            node &&
            node.parent === null &&
            this.isPlaceholderNodeData(node.data)
        );
    }

    ensureRightmostPlaceholderNodes(nodeData) {
        if (!nodeData || typeof nodeData !== 'object') return;

        if (!Array.isArray(nodeData.children) || nodeData.children.length === 0) {
            return;
        }

        nodeData.children.forEach(child => {
            this.ensureRightmostPlaceholderNodes(child);
        });

        if (nodeData._skipAutoPlaceholder) {
            return;
        }

        const lastChild = nodeData.children[nodeData.children.length - 1];

        if (
            lastChild &&
            (
                this.isPlaceholderNodeData(lastChild) ||
                !(lastChild.name || '').trim()
            )
        ) {
            return;
        }

        nodeData.children.push(this.createPlaceholderNode());
    }

    // Generic helpers that operate directly on the plain-object tree by object reference,
    // independent of any particular d3.hierarchy snapshot.
    removeNodeDataFromTree(nodeData) {
        const removeFrom = (node) => {
            if (!node || !Array.isArray(node.children)) return false;
            const idx = node.children.indexOf(nodeData);
            if (idx !== -1) {
                node.children.splice(idx, 1);
                if (node.children.length === 0) delete node.children;
                return true;
            }
            for (const child of node.children) {
                if (removeFrom(child)) return true;
            }
            return false;
        };
        removeFrom(this.rootData);
    }

    unwrapNodeInTree(wrapData, replacementData) {
        if (this.rootData === wrapData) {
            this.rootData = replacementData;
            return;
        }
        const replace = (node) => {
            if (!node || !Array.isArray(node.children)) return false;
            const idx = node.children.indexOf(wrapData);
            if (idx !== -1) {
                node.children[idx] = replacementData;
                return true;
            }
            for (const child of node.children) {
                if (replace(child)) return true;
            }
            return false;
        };
        replace(this.rootData);
    }

    showContextMenu(event, d) {
        // Context menu removed per user request
    }

    hideContextMenu() {
        if (this.contextMenu) {
            this.contextMenu.remove();
            this.contextMenu = null;
            document.removeEventListener('mousedown', this._contextMenuListener);
            this._contextMenuListener = null;
        }
    }

    startCtrlDragNode(event, d) {
        event.preventDefault();
        event.stopPropagation();
        this.skipNextNodeClick = true;
        this.ctrlDragState = {
            source: d,
            startX: event.clientX,
            startY: event.clientY
        };

        d3.selectAll('.node')
            .filter(nd => d.descendants().includes(nd))
            .selectAll('rect')
            .attr('opacity', 0.4);

        const svg = d3.select('svg');
        svg.on('mousemove.ctrlDrag', (moveEvent) => {
            if (!this.ctrlDragState) return;

            const dx = moveEvent.clientX - this.ctrlDragState.startX;
            const dy = moveEvent.clientY - this.ctrlDragState.startY;
            if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
                this.ctrlDragState.hasMoved = true;
            }

            const hoveredNode = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY)?.closest('.node');
            const hoveredDatum = hoveredNode ? d3.select(hoveredNode).datum() : null;
            const sourceD = this.ctrlDragState.source;

            d3.selectAll('.node')
                .selectAll('rect')
                .attr('stroke', d => d === sourceD ? '#ff9900' : '#999')
                .attr('stroke-width', d => d === sourceD ? '3px' : '1.5px');

            if (hoveredDatum && hoveredDatum !== sourceD && !sourceD.descendants().includes(hoveredDatum)) {
                d3.select(hoveredNode)
                    .selectAll('rect')
                    .attr('stroke', '#00a67e')
                    .attr('stroke-width', '3px');
            }
        });

        svg.on('mouseup.ctrlDrag', (upEvent) => {
            if (!this.ctrlDragState) return;
            const nodeEl = document.elementFromPoint(upEvent.clientX, upEvent.clientY)?.closest('.node');
            const targetD = nodeEl ? d3.select(nodeEl).datum() : null;
            const sourceD = this.ctrlDragState.source;

            if (targetD && targetD !== sourceD && !sourceD.descendants().includes(targetD)) {
                this.moveNodeTo(sourceD, targetD);
            }

            this.finishCtrlDrag();
        });

        svg.on('mouseleave.ctrlDrag', () => this.finishCtrlDrag());
    }

    finishCtrlDrag() {
        if (!this.ctrlDragState) return;
        const svg = d3.select('svg');
        svg.on('mousemove.ctrlDrag', null);
        svg.on('mouseup.ctrlDrag', null);
        svg.on('mouseleave.ctrlDrag', null);
        d3.selectAll('.node rect')
            .attr('opacity', 1)
            .attr('stroke', '#999')
            .attr('stroke-width', '1.5px');
        this.ctrlDragState = null;
    }

    startMoveNode(d) {
        this.isMovingNode = true;
        this.movingNodeDatum = d;
        this.movingNodeAncestors = new Set(d.ancestors().map(a => a.data));
        d3.selectAll('.node')
            .filter(nd => d.descendants().includes(nd))
            .selectAll('rect')
            .attr('opacity', 0.4);
        this.showMoveInstruction();
        d3.selectAll('.node')
            .on('click.move', (event, targetD) => {
                if (d === targetD || d.descendants().includes(targetD)) {
                    this.cancelMoveNode();
                    return;
                }
                this.moveNodeTo(d, targetD);
                this.cancelMoveNode();
            });
        d3.select('svg').on('click.cancelmove', (event) => {
            if (event.target.tagName === 'svg') {
                this.cancelMoveNode();
            }
        });
    }

    showMoveInstruction() {
        if (!document.getElementById('move-instruction')) {
            const instr = document.createElement('div');
            instr.id = 'move-instruction';
            instr.style.position = 'absolute';
            instr.style.left = '50%';
            instr.style.bottom = '30px';
            instr.style.transform = 'translateX(-50%)';
            instr.style.background = 'rgba(255,255,255,0.95)';
            instr.style.border = '1px solid #ccc';
            instr.style.padding = '14px 28px';
            instr.style.borderRadius = '8px';
            instr.style.zIndex = 2000;
            instr.style.fontSize = '16px';
            instr.style.boxShadow = '0 2px 12px rgba(0,0,0,0.15)';
            instr.style.display = 'flex';
            instr.style.alignItems = 'center';
            instr.style.gap = '18px';

            const msg = document.createElement('span');
            msg.innerText = 'Select a new parent node';

            const cancelBtn = document.createElement('button');
            cancelBtn.innerText = 'Cancel';
            cancelBtn.style.fontSize = '15px';
            cancelBtn.style.padding = '6px 18px';
            cancelBtn.style.border = '1px solid #aaa';
            cancelBtn.style.borderRadius = '5px';
            cancelBtn.style.background = '#f8f8f8';
            cancelBtn.style.cursor = 'pointer';
            cancelBtn.addEventListener('click', () => this.cancelMoveNode());

            instr.appendChild(msg);
            instr.appendChild(cancelBtn);

            this.flowchartContainer.appendChild(instr);
        }
    }

    hideMoveInstruction() {
        const instr = document.getElementById('move-instruction');
        if (instr) instr.remove();
    }

    cancelMoveNode() {
        this.isMovingNode = false;
        this.movingNodeDatum = null;
        this.movingNodeAncestors = null;
        d3.selectAll('.node rect').attr('opacity', 1);
        d3.selectAll('.node').on('click.move', null);
        d3.select('svg').on('click.cancelmove', null);
        this.hideMoveInstruction();
    }

    startMakeConnection(d) {
        this.isMakingConnection = true;
        this.connectionSourceNode = d;
        d3.selectAll('.node')
            .filter(nd => nd === d)
            .selectAll('rect')
            .attr('stroke', '#ff9900')
            .attr('stroke-width', '2px');
        this.showConnectionInstruction();
        d3.selectAll('.node')
            .on('click.connect', (event, targetD) => {
                if (d === targetD) {
                    this.cancelMakeConnection();
                    return;
                }
                this.createConnection(d, targetD);
                this.hideNodeEditPopup(false);
                this.cancelMakeConnection();
            });
        d3.select('svg').on('click.cancelconnect', (event) => {
            if (event.target.tagName === 'svg') {
                this.cancelMakeConnection();
            }
        });
    }

    showConnectionInstruction() {
        if (!document.getElementById('connection-instruction')) {
            const instr = document.createElement('div');
            instr.id = 'connection-instruction';
            instr.style.position = 'absolute';
            instr.style.left = '50%';
            instr.style.bottom = '30px';
            instr.style.transform = 'translateX(-50%)';
            instr.style.background = 'rgba(255,255,255,0.95)';
            instr.style.border = '1px solid #ccc';
            instr.style.padding = '14px 28px';
            instr.style.borderRadius = '8px';
            instr.style.zIndex = 2000;
            instr.style.fontSize = '16px';
            instr.style.boxShadow = '0 2px 12px rgba(0,0,0,0.15)';
            instr.style.display = 'flex';
            instr.style.alignItems = 'center';
            instr.style.gap = '18px';

            const msg = document.createElement('span');
            msg.innerText = 'Select a target node to connect to';

            const cancelBtn = document.createElement('button');
            cancelBtn.innerText = 'Cancel';
            cancelBtn.style.fontSize = '15px';
            cancelBtn.style.padding = '6px 18px';
            cancelBtn.style.border = '1px solid #aaa';
            cancelBtn.style.borderRadius = '5px';
            cancelBtn.style.background = '#f8f8f8';
            cancelBtn.style.cursor = 'pointer';
            cancelBtn.addEventListener('click', () => this.cancelMakeConnection());

            instr.appendChild(msg);
            instr.appendChild(cancelBtn);

            this.flowchartContainer.appendChild(instr);
        }
    }

    hideConnectionInstruction() {
        const instr = document.getElementById('connection-instruction');
        if (instr) instr.remove();
    }

    cancelMakeConnection() {
        this.isMakingConnection = false;
        if (this.connectionSourceNode) {
            d3.selectAll('.node')
                .filter(nd => nd === this.connectionSourceNode)
                .selectAll('rect')
                .attr('stroke', '#999')
                .attr('stroke-width', '1.5px');
        }
        this.connectionSourceNode = null;
        d3.selectAll('.node').on('click.connect', null);
        d3.select('svg').on('click.cancelconnect', null);
        this.hideConnectionInstruction();
    }

    createConnection(sourceD, targetD) {
        this.pushUndo();

        const sourceLevel = this.getNodeLevel(sourceD);
        const targetLevel = this.getNodeLevel(targetD);

        if (sourceLevel <= targetLevel) {
            this.customConnections.push({
                source: sourceD.data,
                target: targetD.data
            });
        } else {
            this.customConnections.push({
                source: targetD.data,
                target: sourceD.data
            });
        }

        this.renderFlowchart(this.rootData);
        this.autosave();
    }

    cloneData(data) {
        return JSON.parse(JSON.stringify(data));
    }

    pushUndo() {
        const state = {
            data: this.cloneData(this.rootData),
            connections: JSON.parse(JSON.stringify(this.customConnections))
        };
        this.undoStack.push(state);
        if (this.undoStack.length > 100) this.undoStack.shift();
        this.redoStack = [];
        this.updateUndoRedoButtons();
    }

    updateUndoRedoButtons() {
        this.undoBtn.style.opacity = this.undoStack.length > 0 ? "1" : "0.5";
        this.undoBtn.style.pointerEvents = this.undoStack.length > 0 ? "auto" : "none";
        this.redoBtn.style.opacity = this.redoStack.length > 0 ? "1" : "0.5";
        this.redoBtn.style.pointerEvents = this.redoStack.length > 0 ? "auto" : "none";
        if (this.topUndoBtn) {
            this.topUndoBtn.style.opacity = this.undoStack.length > 0 ? "1" : "0.5";
            this.topUndoBtn.style.pointerEvents = this.undoStack.length > 0 ? "auto" : "none";
        }
        if (this.topRedoBtn) {
            this.topRedoBtn.style.opacity = this.redoStack.length > 0 ? "1" : "0.5";
            this.topRedoBtn.style.pointerEvents = this.redoStack.length > 0 ? "auto" : "none";
        }
    }

    undo() {
        if (this.undoStack.length === 0) return;
        const currentState = {
            data: this.cloneData(this.rootData),
            connections: JSON.parse(JSON.stringify(this.customConnections))
        };
        this.redoStack.push(currentState);
        const prev = this.undoStack.pop();
        this.rootData = prev.data;
        this.customConnections = prev.connections;
        this.renderFlowchart(this.rootData);
        this.updateUndoRedoButtons();
        this.autosave();
    }

    redo() {
        if (this.redoStack.length === 0) return;
        const currentState = {
            data: this.cloneData(this.rootData),
            connections: JSON.parse(JSON.stringify(this.customConnections))
        };
        this.undoStack.push(currentState);
        const next = this.redoStack.pop();
        this.rootData = next.data;
        this.customConnections = next.connections;
        this.renderFlowchart(this.rootData);
        this.updateUndoRedoButtons();
        this.autosave();
    }

    moveNodeTo(movingD, newParentD) {
        if (movingD === newParentD || movingD.descendants().includes(newParentD)) {
            return;
        }

        this.pushUndo();
        
        const movingData = movingD.data;
        const parent = movingD.parent;
        
        if (parent) {
            parent.data.children = (parent.data.children || []).filter(child => child !== movingData);
            if (parent.data.children.length === 0) {
                delete parent.data.children;
            } else {
                const children = parent.data.children;
                for (let i = children.length - 2; i >= 0; i--) {
                    if (this.isPlaceholderNodeData(children[i])) {
                        children.splice(i, 1);
                    }
                }
                const lastChild = children[children.length - 1];
                if (!this.isPlaceholderNodeData(lastChild) && lastChild.name && lastChild.name.trim()) {
                    children.push(this.createPlaceholderNode());
                }
            }
        }
        
        if (!newParentD.data.children) {
            newParentD.data.children = [];
        }
        
        const newChildren = newParentD.data.children;
        if (newChildren.length > 0) {
            const lastChild = newChildren[newChildren.length - 1];
            if (this.isPlaceholderNodeData(lastChild)) {
                newChildren.pop();
            }
        }
        
        newParentD.data.children.push(movingData);
        newParentD.data.children.push(this.createPlaceholderNode());
        
        this.ensureRightmostPlaceholderNodes(this.rootData);
        this.updateSimplifyPrefixes(d3.hierarchy(this.rootData));
        
        this.renderFlowchart(this.rootData);
        this.updateUndoRedoButtons();
        this.hideNodeEditPopup(false);
        const renderedNode = this.findRenderedNode(movingData);
        if (renderedNode) {
            this.centerNodeOnMobile(renderedNode, () => {});
        }
        this.autosave();
    }

    addChildNode(d) {
        this.pushUndo();
        if (!d.data.children) d.data.children = [];
        let baseName = "New Node";
        let idx = 1;
        let siblingNames = (d.data.children || []).map(child => child.name);
        let newName = baseName;
        while (siblingNames.includes(newName)) {
            newName = `${baseName} ${idx++}`;
        }
        const newChild = { name: newName, color: '#00a67e' };
        const children = d.data.children;
        const placeholderIndex = children.reduce((lastIndex, child, index) => {
            if (this.isPlaceholderNodeData(child) || !(child.name || '').trim()) {
                return index;
            }
            return lastIndex;
        }, -1);

        if (placeholderIndex !== -1) {
            children.splice(placeholderIndex, 0, newChild);
        } else {
            children.push(newChild);
        }

        this.renderFlowchart(this.rootData);
        this.updateUndoRedoButtons();
        this.autosave();
        return newChild;
    }

    addParentNode(d) {
        this.pushUndo();
        const oldData = d.data;
        const parent = d.parent;
        const newParent = { name: '', color: '#00a67e' };
        newParent.children = [oldData];

        if (parent) {
            const siblings = parent.data.children || [];
            const idx = siblings.indexOf(oldData);
            if (idx !== -1) {
                siblings[idx] = newParent;
            } else {
                siblings.push(newParent);
            }
            parent.data.children = siblings;
        } else {
            this.rootData = newParent;
        }

        this.renderFlowchart(this.rootData);
        let found = null;
        d3.hierarchy(this.rootData).each(node => {
            if (node.data === newParent) found = node;
        });
        if (found) {
            const renderedNode = this.findRenderedNode(newParent) || found;
            this.centerNodeOnMobile(renderedNode, () => {
                this.showNodeEditPopup(found);
                this.nodeEditInput.value = '';
                this.resizeNodeEditInput();
                this.nodeEditInput.focus();
                this.nodeEditInput.select();
            });
        }
        this.updateUndoRedoButtons();
        this.autosave();
        return newParent;
    }

    duplicateNodeToParentSiblings(d) {
        if (!d || !d.parent) {
            alert('Cannot duplicate: node has no parent.');
            return;
        }
        const parent = d.parent;
        const grandparent = parent.parent;
        if (!grandparent) {
            alert('Cannot duplicate: parent has no siblings to duplicate to.');
            return;
        }

        this.pushUndo();

        const nodeCopy = {};
        for (const key in d.data) {
            if (key === 'children') continue;
            nodeCopy[key] = JSON.parse(JSON.stringify(d.data[key]));
        }

        const siblings = (grandparent.data.children || []).filter(child => child !== parent.data);
        siblings.forEach(sibData => {
            if (!sibData.children) sibData.children = [];
            const newNode = JSON.parse(JSON.stringify(nodeCopy));
            const existingNames = sibData.children.map(c => c.name);
            let baseName = newNode.name || 'New Node';
            let newName = baseName;
            let idx = 1;
            while (existingNames.includes(newName)) {
                newName = `${baseName} ${idx++}`;
            }
            newNode.name = newName;
            sibData.children.push(newNode);
        });

        this.renderFlowchart(this.rootData);
        this.updateUndoRedoButtons();
        this.autosave();
    }

    addSiblingNode(d, direction) {
        if (!d.parent) {
            alert('Cannot add a sibling to the root node.');
            return null;
        }
        this.pushUndo();
        const parent = d.parent;
        if (!parent.data.children) parent.data.children = [];
        const siblings = parent.data.children;
        // Siblings start out empty (placeholder styling) - only newly spawned *child*
        // nodes default to green (see addChildNode).
        const newSibling = this.createPlaceholderNode();
        const idxPos = siblings.indexOf(d.data);
        const insertAt = direction < 0 ? idxPos : idxPos + 1;
        siblings.splice(insertAt, 0, newSibling);
        this.renderFlowchart(this.rootData);
        let found = null;
        d3.hierarchy(this.rootData).each(node => {
            if (node.data === newSibling) found = node;
        });
        if (found) {
            const renderedNode = this.findRenderedNode(newSibling) || found;
            this.centerNodeOnMobile(renderedNode, () => this.showNodeEditPopup(found));
        }
        this.updateUndoRedoButtons();
        this.autosave();
        return newSibling;
    }

    deleteNodeAndPromoteChildren(d) {
        if (!d.parent) {
            alert('Cannot delete the root node.');
            return;
        }
        this.pushUndo();
        const parent = d.parent;
        const siblings = parent.data.children || [];
        const idx = siblings.indexOf(d.data);
        const children = d.data.children || [];
        if (idx !== -1) {
            siblings.splice(idx, 1);
            if (children.length > 0) {
                siblings.splice(idx, 0, ...children);
            }
        }
        if (parent.data.children && parent.data.children.length === 0) delete parent.data.children;
        this.customConnections = this.customConnections.filter(conn => conn.source !== d.data && conn.target !== d.data);
        this.renderFlowchart(this.rootData);
        this.updateUndoRedoButtons();
        this.autosave();
    }

    deleteNode(d) {
        if (!d.parent) {
            alert("Cannot delete the root node.");
            return;
        }
        this.pushUndo();
        const parent = d.parent;
        parent.data.children = (parent.data.children || []).filter(child => child !== d.data);
        if (parent.data.children.length === 0) delete parent.data.children;
        this.customConnections = this.customConnections.filter(conn =>
            conn.source !== d.data && conn.target !== d.data
        );
        this.renderFlowchart(this.rootData);
        this.updateUndoRedoButtons();
        this.autosave();
    }

    getNodeNameFromInput(color = null) {
        let name = (this.nodeEditInput.value || '').trim();
        if (name.startsWith('Assumption: ')) {
            name = name.substring('Assumption: '.length);
        }
        if (name.endsWith(' (Simplify?)')) {
            name = name.substring(0, name.length - ' (Simplify?)'.length);
        }
        if (color === '#e75480') {
            name = 'Assumption: ' + name;
        }
        return name;
    }

    // Grows the node-edit textarea to fit however many lines the wrapped text now
    // takes, so the box expands downward instead of scrolling internally.
    resizeNodeEditInput() {
        const el = this.nodeEditInput;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = (el.scrollHeight + 2) + 'px';
    }

    showNodeEditPopup(d) {
        if (!d || !d.data) return;

        this.nodeBeingEdited = d;
        this._suppressPopupHide = false;
        
        // Get the display name without prefixes/suffixes
        let displayName = d.data.name || '';
        
        // Remove "Assumption: " prefix if present
        if (displayName.startsWith('Assumption: ')) {
            displayName = displayName.substring('Assumption: '.length);
        }
        
        // Remove " (Simplify?)" suffix if present
        if (displayName.endsWith(' (Simplify?)')) {
            displayName = displayName.substring(0, displayName.length - ' (Simplify?)'.length);
        }
        
        this.nodeEditInput.value = displayName;
        this.resizeNodeEditInput();
        setTimeout(() => {
            try { this.nodeEditInput.select(); } catch (e) { /* ignore */ }
        }, 0);
        
        let colorBtns = document.getElementById('node-color-btns');
        if (!colorBtns) {
            colorBtns = document.createElement('div');
            colorBtns.id = 'node-color-btns';
            colorBtns.style.display = 'flex';
            colorBtns.style.gap = '10px';
            colorBtns.style.marginBottom = '10px';
            colorBtns.style.justifyContent = 'center';
            colorBtns.style.flexWrap = 'wrap';
            
            const greenBtn = document.createElement('button');
            greenBtn.textContent = 'Green';
            greenBtn.style.background = '#00a67e';
            greenBtn.style.color = 'white';
            greenBtn.style.border = 'none';
            greenBtn.style.borderRadius = '5px';
            greenBtn.style.padding = '6px 16px';
            greenBtn.style.cursor = 'pointer';
            greenBtn.onmousedown = (e) => e.preventDefault();
            greenBtn.onclick = () => {
                if (this.nodeBeingEdited) {
                    this._suppressPopupHide = true;
                    this.pushUndo();
                    if (this.isPlaceholderNodeData(this.nodeBeingEdited.data)) {
                        this.markNodeAsReal(this.nodeBeingEdited.data);
                    }
                    const currentNode = this.nodeBeingEdited;
                    currentNode.data.name = this.getNodeNameFromInput('#00a67e');
                    currentNode.data.color = '#00a67e';
                    this.ensureRightmostPlaceholderNodes(this.rootData);
                    this.updateSimplifyPrefixes(d3.hierarchy(this.rootData));
                    this.renderFlowchart(this.rootData);
                    this._suppressPopupHide = false;
                    this.updateReflectionPanel(currentNode);
                    this.hideNodeEditPopup(false);
                    this.autosave();
                }
            };
            
            const pinkBtn = document.createElement('button');
            pinkBtn.textContent = 'Pink';
            pinkBtn.style.background = '#e75480';
            pinkBtn.style.color = 'white';
            pinkBtn.style.border = 'none';
            pinkBtn.style.borderRadius = '5px';
            pinkBtn.style.padding = '6px 16px';
            pinkBtn.style.cursor = 'pointer';
            pinkBtn.onmousedown = (e) => e.preventDefault();
            pinkBtn.onclick = () => {
                if (this.nodeBeingEdited) {
                    this._suppressPopupHide = true;
                    this.pushUndo();
                    if (this.isPlaceholderNodeData(this.nodeBeingEdited.data)) {
                        this.markNodeAsReal(this.nodeBeingEdited.data);
                    }
                    const currentNode = this.nodeBeingEdited;
                    currentNode.data.name = this.getNodeNameFromInput('#e75480');
                    currentNode.data.color = '#e75480';
                    this.ensureRightmostPlaceholderNodes(this.rootData);
                    this.updateSimplifyPrefixes(d3.hierarchy(this.rootData));
                    this.renderFlowchart(this.rootData);
                    this._suppressPopupHide = false;
                    this.updateReflectionPanel(currentNode);
                    this.hideNodeEditPopup(false);
                    this.autosave();
                }
            };
            
            const blueBtn = document.createElement('button');
            blueBtn.textContent = 'Blue';
            blueBtn.style.background = '#0074d9';
            blueBtn.style.color = 'white';
            blueBtn.style.border = 'none';
            blueBtn.style.borderRadius = '5px';
            blueBtn.style.padding = '6px 16px';
            blueBtn.style.cursor = 'pointer';
            blueBtn.onmousedown = (e) => e.preventDefault();
            blueBtn.onclick = () => {
                if (this.nodeBeingEdited) {
                    this._suppressPopupHide = true;
                    this.pushUndo();
                    if (this.isPlaceholderNodeData(this.nodeBeingEdited.data)) {
                        this.markNodeAsReal(this.nodeBeingEdited.data);
                    }
                    const currentNode = this.nodeBeingEdited;
                    currentNode.data.name = this.getNodeNameFromInput('#0074d9');
                    currentNode.data.color = '#0074d9';
                    this.ensureRightmostPlaceholderNodes(this.rootData);
                    this.updateSimplifyPrefixes(d3.hierarchy(this.rootData));
                    this.renderFlowchart(this.rootData);
                    this._suppressPopupHide = false;
                    this.updateReflectionPanel(currentNode);
                    this.hideNodeEditPopup(false);
                    this.autosave();
                }
            };
            
            const yellowBtn = document.createElement('button');
            yellowBtn.textContent = 'Yellow';
            yellowBtn.style.background = '#ffcc00';
            yellowBtn.style.color = 'black';
            yellowBtn.style.border = 'none';
            yellowBtn.style.borderRadius = '5px';
            yellowBtn.style.padding = '6px 16px';
            yellowBtn.style.cursor = 'pointer';
            yellowBtn.onmousedown = (e) => e.preventDefault();
            yellowBtn.onclick = () => {
                if (this.nodeBeingEdited) {
                    this._suppressPopupHide = true;
                    this.pushUndo();
                    if (this.isPlaceholderNodeData(this.nodeBeingEdited.data)) {
                        this.markNodeAsReal(this.nodeBeingEdited.data);
                    }
                    const currentNode = this.nodeBeingEdited;
                    currentNode.data.name = this.getNodeNameFromInput('#ffcc00');
                    currentNode.data.color = '#ffcc00';
                    this.ensureRightmostPlaceholderNodes(this.rootData);
                    this.updateSimplifyPrefixes(d3.hierarchy(this.rootData));
                    this.renderFlowchart(this.rootData);
                    this._suppressPopupHide = false;
                    this.updateReflectionPanel(currentNode);
                    this.hideNodeEditPopup(false);
                    this.autosave();
                }
            };
            
            const emptyBtn = document.createElement('button');
            emptyBtn.textContent = 'Empty';
            emptyBtn.style.background = '#323a4a';
            emptyBtn.style.color = 'white';
            emptyBtn.style.border = 'none';
            emptyBtn.style.borderRadius = '5px';
            emptyBtn.style.padding = '6px 16px';
            emptyBtn.style.cursor = 'pointer';
            emptyBtn.onmousedown = (e) => e.preventDefault();
            emptyBtn.onclick = () => {
                if (this.nodeBeingEdited) {
                    this._suppressPopupHide = true;
                    this.pushUndo();
                    const currentNode = this.nodeBeingEdited;
                    currentNode.data.color = this.getPlaceholderColor();
                    currentNode.data.name = '';
                    currentNode.data._isPlaceholder = true;
                    this.ensureRightmostPlaceholderNodes(this.rootData);
                    this.updateSimplifyPrefixes(d3.hierarchy(this.rootData));
                    this.renderFlowchart(this.rootData);
                    this._suppressPopupHide = false;
                    this.updateReflectionPanel(currentNode);
                    this.hideNodeEditPopup(false);
                    this.autosave();
                }
            };
            
            colorBtns.appendChild(greenBtn);
            colorBtns.appendChild(pinkBtn);
            colorBtns.appendChild(blueBtn);
            colorBtns.appendChild(yellowBtn);
            colorBtns.appendChild(emptyBtn);
            this.nodeEditPopup.insertBefore(colorBtns, this.nodeEditPopup.firstChild);
        }
        
        Array.from(colorBtns.children).forEach(btn => {
            if (btn.textContent === 'Green' && d.data.color === '#00a67e') {
                btn.style.outline = '2px solid #00a67e';
            } else if (btn.textContent === 'Pink' && d.data.color === '#e75480') {
                btn.style.outline = '2px solid #e75480';
            } else if (btn.textContent === 'Blue' && d.data.color === '#0074d9') {
                btn.style.outline = '2px solid #0074d9';
            } else if (btn.textContent === 'Yellow' && d.data.color === '#ffcc00') {
                btn.style.outline = '2px solid #ffcc00';
            } else if (btn.textContent === 'Empty' && this.isPlaceholderNodeData(d.data)) {
                btn.style.outline = '2px solid #323a4a';
            } else {
                btn.style.outline = 'none';
            }
        });

        this.nodeEditPopup.style.display = 'block';
        // The textarea must be visible (display:block on the popup) before scrollHeight
        // reflects real content, so resize here rather than only right after setting .value.
        this.resizeNodeEditInput();

        const isMobile = window.matchMedia('(max-width: 600px)').matches;
        // Default view: desktop shows the reflection panel (if any) automatically
        // alongside this popup, as it always has. Mobile defaults to the node edit menu
        // (this popup + the radial popup buttons on the canvas); the toggle button
        // switches to the reflection/question-boxes view instead, when available.
        this._reflectionPanelActive = !isMobile;
        this.nodeEditInput.focus();
        this.nodeEditInput.select();

        this.positionNodeEditPopupForMobile();
        this.updateReflectionPanel(d);
    }

    // On mobile, positions the node edit popup's top edge halfway between the center of
    // the top half of the screen (25% - where the node is centered, see
    // centerNodeOnMobile) and the vertical midline (50%), i.e. 37.5% down the screen,
    // then nudges it down by one popup button's height (40px, matching btnHeight in
    // refreshRadialButtons) for extra clearance from the node/buttons above. This keeps
    // it clear of the node above without depending on the keyboard's actual height.
    positionNodeEditPopupForMobile() {
        const isMobile = window.matchMedia('(max-width: 600px)').matches;
        if (!isMobile) {
            // Desktop: keep the popup centered on the window (not "snapped" to wherever
            // the clicked node happens to be), and clear of the bottom-right control
            // buttons (Undo, Reset View, Export, etc.) - those wrap onto more rows the
            // narrower the window gets, so their height is measured live instead of
            // assuming a fixed offset.
            this.nodeEditPopup.style.position = 'fixed';
            this.nodeEditPopup.style.left = '50%';
            this.nodeEditPopup.style.transform = 'translateX(-50%)';
            this.nodeEditPopup.style.top = '';
            this.nodeEditPopup.style.maxHeight = '';

            let clearance = 80;
            if (this.resetViewBtn) {
                const controlsEl = this.resetViewBtn.closest('.reset-view-controls');
                if (controlsEl) {
                    const rect = controlsEl.getBoundingClientRect();
                    if (rect.height > 0) {
                        clearance = (window.innerHeight - rect.top) + 20;
                    }
                }
            }
            this.nodeEditPopup.style.bottom = clearance + 'px';
            return;
        }

        this.nodeEditPopup.style.position = 'absolute';
        this.nodeEditPopup.style.left = '50%';
        this.nodeEditPopup.style.transform = 'translateX(-50%)';

        const POPUP_BTN_HEIGHT = 40;
        const viewportHeight = window.innerHeight;
        const topPosition = (viewportHeight * 0.375) + POPUP_BTN_HEIGHT;

        this.nodeEditPopup.style.top = topPosition + 'px';
        this.nodeEditPopup.style.bottom = 'auto';
        this.nodeEditPopup.style.maxHeight = Math.max(120, viewportHeight - topPosition - 20) + 'px';
    }

    // Updates one node's on-screen text/box directly, without touching any other DOM
    // element or rebinding the zoom behavior. Used when a text edit is saved mid-pan,
    // where a full renderFlowchart (which tears down and rebuilds the whole SVG) would
    // disrupt the active gesture. This only fixes up the edited node itself - any
    // knock-on layout changes (siblings shifting, etc.) are corrected by the real
    // renderFlowchart once the gesture ends.
    quickPatchNodeText(d) {
        if (!d || !d.data) return;
        const selectedData = d.data;
        const nodeEls = d3.selectAll('#flowchart .node');
        if (nodeEls.empty()) return;
        let targetEl = null;
        nodeEls.each(function(nd) {
            if (nd && nd.data === selectedData) targetEl = this;
        });
        if (!targetEl) return;

        const NODE_WIDTH = 120;
        const LINE_HEIGHT = 18;
        const PADDING_Y = 12;
        const FONT_SIZE = 13;
        const FONT_FAMILY = 'Arial, sans-serif';

        const measureTextWidth = (text) => {
            const tempSvg = d3.select('body').append('svg')
                .attr('style', 'position:absolute;left:-9999px;top:-9999px');
            const tempText = tempSvg.append('text')
                .attr('font-size', FONT_SIZE)
                .attr('font-family', FONT_FAMILY)
                .text(text);
            const width = tempText.node().getComputedTextLength();
            tempSvg.remove();
            return width;
        };

        const rawName = selectedData.name || '';
        const words = rawName.split(/(\s+)/);
        let lines = [];
        let current = '';
        words.forEach(word => {
            const testLine = (current + word).trim();
            if (testLine && measureTextWidth(testLine) > NODE_WIDTH - 16) {
                if (current) lines.push(current.trim());
                current = word.trim();
            } else {
                current += word;
            }
        });
        if (current.trim()) lines.push(current.trim());
        const finalLines = lines.length ? lines : [rawName || ''];
        d._lines = finalLines;

        const g = d3.select(targetEl);
        const rectHeight = finalLines.length * LINE_HEIGHT + PADDING_Y;
        g.select('rect')
            .attr('height', rectHeight)
            .attr('y', -(rectHeight / 2));

        const text = g.select('text');
        text.selectAll('tspan').remove();
        finalLines.forEach((line, i, arr) => {
            text.append('tspan')
                .attr('x', 0)
                .attr('y', (i - (arr.length - 1) / 2) * LINE_HEIGHT + 4)
                .text(line);
        });
        if (selectedData._collapsed) {
            if (this.orientation === 'LR') {
                text.append('tspan')
                    .attr('x', NODE_WIDTH / 2 + 16)
                    .attr('y', 4)
                    .attr('fill', '#ffffff')
                    .attr('font-size', FONT_SIZE + 3)
                    .text('▶');
            } else {
                text.append('tspan')
                    .attr('x', 0)
                    .attr('y', finalLines.length * LINE_HEIGHT / 2 + 25)
                    .attr('fill', '#ffffff')
                    .attr('font-size', FONT_SIZE + 3)
                    .text('▼');
            }
        }
    }

    saveNodeEdit(deferRender = false) {
        if (!this.nodeBeingEdited) return;
        const originalData = this.nodeBeingEdited.data;
        const wasPlaceholder = this.isPlaceholderNodeData(originalData);
        const isRootPlaceholder = this.isRootPlaceholderNode(this.nodeBeingEdited);
        let newName = this.getNodeNameFromInput(originalData.color);

        // If the field reads back empty (e.g. a just-created node whose input we
        // deliberately cleared for typing, then the user panned away before typing
        // anything) don't blank out its name - keep whatever it already was.
        if (!newName.trim() && originalData.name && originalData.name.trim()) {
            newName = originalData.name;
        }

        // Add " (Simplify?)" suffix for green leaf nodes (only once there's an actual
        // name - otherwise a freshly created, not-yet-typed-into node would end up
        // saved as the broken " (Simplify?)" with no real name at all).
        if (newName.trim() && this.isLeafNode(this.nodeBeingEdited) && this.isGreenNode(this.nodeBeingEdited)) {
            newName = newName + ' (Simplify?)';
        }

        const nameChanged = newName !== originalData.name;
        const needsWrap = isRootPlaceholder && originalData.color !== this.getPlaceholderColor();

        if (nameChanged || needsWrap) {
            this.pushUndo();
            if (wasPlaceholder) {
                this.markNodeAsReal(originalData);
            }
            originalData.name = newName;
            if (needsWrap) {
                this.rootData = this.wrapRootWithPlaceholder(this.rootData);
            }
            this.ensureRightmostPlaceholderNodes(this.rootData);
            this.updateSimplifyPrefixes(d3.hierarchy(this.rootData));
            if (deferRender) {
                // Recreating the SVG right now would break an in-progress pan/zoom
                // gesture's pointer tracking (causing the next gesture to jump), so hold
                // off until the gesture actually finishes (see the zoom behavior's 'end'
                // handler). The data above is already fully committed either way; patch
                // the node's on-screen text immediately so the edit is visible right
                // away instead of only after the pan ends.
                this._deferredRenderPending = true;
                try {
                    this.quickPatchNodeText(this.nodeBeingEdited);
                } catch (err) {
                    console.error('Error patching node text in place:', err);
                }
            } else {
                const editedRef = this.nodeBeingEdited;
                this.renderFlowchart(this.rootData);
                if (!this.nodeBeingEdited) {
                    this.nodeBeingEdited = editedRef;
                }
            }
        }
        this.autosave();
        this.hideContextMenu();
    }

    moveNodeInSiblings(d, direction) {
        if (!d.parent) return;
        const siblings = d.parent.data.children;
        const idx = siblings.indexOf(d.data);
        if (idx === -1) return;
        const newIdx = idx + direction;
        if (newIdx < 0 || newIdx >= siblings.length) return;
        this.pushUndo();
        [siblings[idx], siblings[newIdx]] = [siblings[newIdx], siblings[idx]];
        this.renderFlowchart(this.rootData);
        let found = null;
        d3.hierarchy(this.rootData).each(node => {
            if (node.data === d.data) found = node;
        });
        if (found) {
            const renderedNode = this.findRenderedNode(d.data) || found;
            this.centerNodeOnMobile(renderedNode, () => this.showNodeEditPopup(found));
        }
        this.autosave();
    }

    hideNodeEditPopup(save = true, deferRender = false) {
        this._pendingNodeSave = false;
        if (save) this.saveNodeEdit(deferRender);
        this.nodeEditPopup.style.display = 'none';
        this.nodeBeingEdited = null;
        this._suppressPopupHide = false;
        const colorBtns = document.getElementById('node-color-btns');
        if (colorBtns) colorBtns.remove();
        this.applyMobileViewState();
    }

    // Resolves a node's raw data object back to its currently-rendered hierarchy node -
    // the one bound to the actual DOM element, which has real .x/.y coordinates from the
    // last layout pass. A fresh d3.hierarchy(this.rootData) call, by contrast, builds new
    // node wrappers with no coordinates at all (no layout algorithm has run on them),
    // which is only safe to use for their .data - never for positioning.
    findRenderedNode(nodeData) {
        if (!nodeData) return null;
        let found = null;
        d3.selectAll('#flowchart .node').each(function(nd) {
            if (nd && nd.data === nodeData) found = nd;
        });
        return found;
    }

    // Returns the guided question set for a node's current color, or null if the node
    // isn't an Assumption (pink) or Simplify (green) node.
    getReflectionQuestions(nodeData) {
        if (!nodeData) return null;
        if (nodeData.color === '#e75480') return this.ASSUMPTION_QUESTIONS;
        if (nodeData.color === '#00a67e') return this.SIMPLIFY_QUESTIONS;
        return null;
    }

    // Wires up the reflection panel's close button, drag-to-resize handle (desktop), and
    // mobile full-screen toggle button. Called once from the constructor.
    setupReflectionPanel() {
        if (this.reflectionPanelClose) {
            this.reflectionPanelClose.addEventListener('click', () => this.hideReflectionPanel());
        }

        if (this.topToggleReflectionBtn) {
            this.topToggleReflectionBtn.addEventListener('click', () => this.toggleMobileFieldsVisibility());
        }

        if (this.reflectionPanelBackBtn) {
            this.reflectionPanelBackBtn.addEventListener('click', () => this.toggleMobileFieldsVisibility());
        }

        if (this.reflectionPanelResizeHandle) {
            let dragging = false;
            let startX = 0;
            let startWidth = 0;
            const onMove = (clientX) => {
                if (!dragging) return;
                const delta = clientX - startX;
                const maxWidth = window.innerWidth * 0.8;
                const newWidth = Math.max(220, Math.min(startWidth + delta, maxWidth));
                this._reflectionPanelWidth = newWidth;
                this.reflectionPanel.style.width = newWidth + 'px';
            };
            const onEnd = () => {
                if (!dragging) return;
                dragging = false;
                document.body.style.userSelect = '';
                localStorage.setItem('reflection-panel-width', String(this._reflectionPanelWidth));
            };
            this.reflectionPanelResizeHandle.addEventListener('mousedown', (e) => {
                dragging = true;
                startX = e.clientX;
                startWidth = this.reflectionPanel.getBoundingClientRect().width;
                document.body.style.userSelect = 'none';
                e.preventDefault();
            });
            window.addEventListener('mousemove', (e) => onMove(e.clientX));
            window.addEventListener('mouseup', onEnd);
            this.reflectionPanelResizeHandle.addEventListener('touchstart', (e) => {
                dragging = true;
                startX = e.touches[0].clientX;
                startWidth = this.reflectionPanel.getBoundingClientRect().width;
            }, { passive: true });
            window.addEventListener('touchmove', (e) => {
                if (!dragging) return;
                onMove(e.touches[0].clientX);
            }, { passive: true });
            window.addEventListener('touchend', onEnd);
        }
    }

    // Shows/updates/hides the reflection panel for whichever node was just
    // opened/selected. Called from showNodeEditPopup so it tracks node selection.
    // Turns a plain textarea into an auto-bulleting, auto-growing list: every line gets
    // a leading bullet, Enter starts a new bulleted line instead of a bare newline, and
    // the box grows taller to fit its content instead of scrolling internally.
    resizeReflectionAnswer(textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = (textarea.scrollHeight + 2) + 'px';
    }

    setupBulletAnswerTextarea(textarea, onChange) {
        const BULLET = '\u2022 ';

        const ensureLeadingBullet = () => {
            if (textarea.value && !textarea.value.startsWith(BULLET)) {
                const cursor = textarea.selectionStart;
                textarea.value = BULLET + textarea.value;
                textarea.selectionStart = textarea.selectionEnd = cursor + BULLET.length;
            }
        };

        textarea.addEventListener('focus', () => {
            if (!textarea.value) {
                textarea.value = BULLET;
                textarea.selectionStart = textarea.selectionEnd = textarea.value.length;
            } else {
                ensureLeadingBullet();
            }
            this.resizeReflectionAnswer(textarea);
        });

        textarea.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const start = textarea.selectionStart;
                const end = textarea.selectionEnd;
                const insertion = '\n' + BULLET;
                textarea.value = textarea.value.slice(0, start) + insertion + textarea.value.slice(end);
                const newPos = start + insertion.length;
                textarea.selectionStart = textarea.selectionEnd = newPos;
                this.resizeReflectionAnswer(textarea);
                onChange(textarea.value);
            }
        });

        textarea.addEventListener('input', () => {
            ensureLeadingBullet();
            this.resizeReflectionAnswer(textarea);
            onChange(textarea.value);
        });
    }

    updateReflectionPanel(d) {
        if (!d || !d.data) {
            this._reflectionQuestions = null;
            this._reflectionNodeData = null;
            this.reflectionPanelBody.innerHTML = '';
            this.applyMobileViewState();
            return;
        }
        const questions = this.getReflectionQuestions(d.data);
        this._reflectionQuestions = questions;
        if (!questions) {
            this._reflectionNodeData = null;
            this.reflectionPanelBody.innerHTML = '';
            this.applyMobileViewState();
            return;
        }

        const nodeData = d.data;
        this._reflectionNodeData = nodeData;
        if (!Array.isArray(nodeData._reflectionAnswers)) {
            nodeData._reflectionAnswers = [];
        }

        this.reflectionPanelTitle.textContent = nodeData.color === '#e75480'
            ? 'Assumption Questions'
            : 'Simplify Questions';

        this.reflectionPanelBody.innerHTML = '';
        questions.forEach((question, i) => {
            const wrap = document.createElement('div');

            const label = document.createElement('div');
            label.className = 'reflection-question';
            label.textContent = question;

            const textarea = document.createElement('textarea');
            textarea.className = 'reflection-answer';
            textarea.rows = 1;
            textarea.value = nodeData._reflectionAnswers[i] || '';
            this.setupBulletAnswerTextarea(textarea, (value) => {
                nodeData._reflectionAnswers[i] = value;
                this._pendingReflectionSave = true;
            });
            textarea.addEventListener('blur', () => {
                if (this._pendingReflectionSave) {
                    this._pendingReflectionSave = false;
                    this.autosave();
                }
            });

            wrap.appendChild(label);
            wrap.appendChild(textarea);
            this.reflectionPanelBody.appendChild(wrap);
        });

        this.applyMobileViewState();
        this.reflectionPanelBody.querySelectorAll('.reflection-answer').forEach(ta => {
            this.resizeReflectionAnswer(ta);
        });
    }

    // Explicit close (the X button): dismiss the reflection view (same effect as
    // toggling it off) without forgetting that this node has a reflection/question set -
    // otherwise the mobile toggle button would vanish since there'd be nothing left to
    // toggle to.
    hideReflectionPanel() {
        this._reflectionPanelActive = false;
        this.applyMobileViewState();
        if (this.nodeEditPopup.style.display === 'block' &&
            window.matchMedia('(max-width: 600px)').matches) {
            this.nodeEditInput.focus();
            this.nodeEditInput.select();
        }
    }

    // Full reset: used when switching/creating flowcharts, where any previous node's
    // reflection state (and its availability) no longer applies at all.
    resetReflectionState() {
        this._reflectionQuestions = null;
        this._reflectionNodeData = null;
        this._reflectionPanelActive = false;
        this.reflectionPanelBody.innerHTML = '';
        this.applyMobileViewState();
    }

    // Single source of truth for what's visible on screen: the node edit popup, the
    // reflection panel, and the mobile toggle button. On desktop, the reflection panel
    // (when available and not dismissed) sits beside the node edit popup as always. On
    // mobile, the node edit menu is the default view; the toggle button - shown only
    // when the current node actually has a reflection/question set - switches to a
    // full-screen view of that panel instead, hiding the node edit menu while active.
    applyMobileViewState() {
        const isMobile = window.matchMedia('(max-width: 600px)').matches;
        const panelActive = Boolean(this._reflectionQuestions) && this._reflectionPanelActive;

        if (!isMobile) {
            this.topToggleReflectionBtn.style.display = 'none';
            this.reflectionPanel.style.display = panelActive ? 'flex' : 'none';
            if (panelActive) {
                this.reflectionPanel.style.width = this._reflectionPanelWidth + 'px';
            }
            return;
        }

        this.topToggleReflectionBtn.style.display = 'flex';
        this.reflectionPanel.style.display = panelActive ? 'flex' : 'none';
        this.nodeEditPopup.style.display = (!panelActive && this.nodeBeingEdited) ? 'block' : 'none';
    }

    // Toggles between the node edit menu and the reflection/question-boxes view on
    // mobile. Switching to the text-boxes view is also when the keyboard closes (the
    // node edit input is hidden); switching back re-focuses it.
    toggleMobileFieldsVisibility() {
        if (!this._reflectionQuestions) return;
        this._reflectionPanelActive = !this._reflectionPanelActive;
        this.applyMobileViewState();
        if (this._reflectionPanelActive) {
            if (document.activeElement === this.nodeEditInput) {
                this.nodeEditInput.blur();
            }
        } else if (this.nodeEditPopup.style.display === 'block') {
            this.nodeEditInput.focus();
            this.nodeEditInput.select();
        }
    }

    exportAsJSON() {
        function stripParents(node) {
            const { name, children, color, _collapsed, _reflectionAnswers, _isPlaceholder } = node;
            const out = { name };
            if (color) out.color = color;
            if (_collapsed) out._collapsed = true;
            if (_isPlaceholder) out._isPlaceholder = true;
            if (Array.isArray(_reflectionAnswers) && _reflectionAnswers.some(a => a && a.trim())) {
                out._reflectionAnswers = _reflectionAnswers;
            }
            if (children) out.children = children.map(stripParents);
            return out;
        }
        return JSON.stringify({
            tree: stripParents(this.rootData),
            customConnections: this.customConnections.map(conn => ({
                source: conn.source.name,
                target: conn.target.name,
                _offset: conn._offset || 0
            })),
            orientation: this.orientation,
            showPlaceholders: this.showPlaceholders,
            transform: { x: this.transform.x, y: this.transform.y, k: this.transform.k }
        }, null, 2);
    }

    exportAllAsJSON() {
        this.saveCurrentFlowchart();
        const exportData = this.flowchartList.map(item => ({
            title: item.title,
            data: item.data
        }));
        return JSON.stringify(exportData, null, 2);
    }

    exportAsText() {
        function walk(node, depth = 0) {
            let lines = [];
            lines.push(' '.repeat(depth * 2) + node.name);
            if (node.children) {
                for (const child of node.children) {
                    lines = lines.concat(walk(child, depth + 1));
                }
            }
            return lines;
        }
        return walk(this.rootData).join('\n');
    }

    // ===== AI EXPORT (Auto-copy to clipboard) =====
    exportToAi() {
        const treeString = this.convertToTreeDiagram();
        
        // Copy to clipboard
        navigator.clipboard.writeText(treeString).then(() => {
            this.showNotification('AI tree copied to clipboard!');
        }).catch(() => {
            // Fallback for older browsers
            const textarea = document.createElement('textarea');
            textarea.value = treeString;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            try {
                document.execCommand('copy');
                this.showNotification('AI tree copied to clipboard!');
            } catch (err) {
                this.showNotification('Failed to copy. Please copy manually.');
            }
            document.body.removeChild(textarea);
        });
    }

    getColorMetadataSuffix(color) {
        if (!color) return '';
        const normalized = (color || '').toLowerCase();
        const colorNames = {
            '#00a67e': 'green',
            '#e75480': 'pink',
            '#0074d9': 'blue',
            '#ffcc00': 'yellow',
            '#323a4a': 'empty'
        };
        const token = colorNames[normalized] || color;
        if (token === 'green' || token === 'pink') return '';
        return ` [color=${token}]`;
    }

    parseColorMetadata(name) {
        let text = name || '';
        let color = undefined;
        const match = text.match(/\s*\[color\s*[:=]\s*([^\]]+)\]$/i);
        if (match) {
            const token = (match[1] || '').trim().toLowerCase();
            const colorMap = {
                'green': '#00a67e',
                'pink': '#e75480',
                'blue': '#0074d9',
                'yellow': '#ffcc00',
                'empty': '#323a4a',
                '#00a67e': '#00a67e',
                '#e75480': '#e75480',
                '#0074d9': '#0074d9',
                '#ffcc00': '#ffcc00',
                '#323a4a': '#323a4a'
            };
            color = colorMap[token];
            text = text.substring(0, match.index).trimEnd();
        }
        return { name: text, color };
    }

    convertToTreeDiagram() {
        // Don't try to guess/unwrap the "real" root here. A node with a blank name or no
        // color (including the invisible wrapper root, or a leftover placeholder that a
        // real child got added under) simply produces no bullet line for itself below -
        // its children are still visited and exported normally, so nothing gets dropped.
        const treeData = this.rootData;

        const lines = [];
        const prefixMap = {
            '#00a67e': '(solution) ',
            '#e75480': '(assumption) '
        };

        const getLabel = (node) => {
            let name = node.name || '';
            // Remove "(Simplify?)" suffix for display
            if (name.endsWith(' (Simplify?)')) {
                name = name.substring(0, name.length - ' (Simplify?)'.length);
            }
            const prefix = prefixMap[node.color] || '';
            const colorSuffix = this.getColorMetadataSuffix(node.color);
            return prefix + name + colorSuffix;
        };

        const buildTree = (node, depth = 0) => {
            const label = getLabel(node);
            const hasLabel = Boolean(label && label.trim());
            if (hasLabel) {
                const indent = '    '.repeat(depth);
                lines.push(`${indent}- ${label}`);
            }

            if (node.children && node.children.length > 0) {
                // Visit every child, even placeholder or blank-named ones - a node created
                // without a name or color (or a still-unconverted placeholder that had a
                // real child added under it) must not hide real content beneath it. Nodes
                // that themselves produce no label are simply skipped when printing, and
                // their children are kept at the same depth as their nearest labeled
                // ancestor so the indentation stays meaningful.
                node.children.forEach(child => {
                    buildTree(child, hasLabel ? depth + 1 : depth);
                });
            }
        };

        buildTree(treeData);
        return lines.join('\n');
    }

    // ===== AI IMPORT (Auto-read from clipboard) =====
    importFromAi() {
        // Try to read from clipboard
        navigator.clipboard.readText().then(text => {
            if (!text || !text.trim()) {
                this.showNotification('Clipboard is empty. Copy a tree diagram first.');
                return;
            }
            this.processAiTree(text);
        }).catch(() => {
            // Fallback: prompt user to paste
            const text = prompt('Paste the AI tree diagram:');
            if (text && text.trim()) {
                this.processAiTree(text);
            } else {
                this.showNotification('No text provided.');
            }
        });
    }

    processAiTree(text) {
        try {
            const tree = this.parseTreeDiagram(text);
            if (!tree) {
                this.showNotification('Failed to parse the tree diagram. Please check the format.');
                return;
            }

            // Apply colors based on explicit prefixes or encoded metadata; leave plain nodes uncolored
            const applyColors = (node) => {
                let name = node.name || '';
                let color = undefined;
                const parsed = this.parseColorMetadata(name);
                name = parsed.name;
                color = parsed.color;
                
                if (name.startsWith('(solution) ')) {
                    name = name.substring('(solution) '.length);
                    color = '#00a67e';
                } else if (name.startsWith('(assumption) ')) {
                    name = name.substring('(assumption) '.length);
                    color = '#e75480';
                }
                
                node.name = name;
                if (color) {
                    node.color = color;
                } else {
                    delete node.color;
                }
                
                if (node.children) {
                    node.children.forEach(child => applyColors(child));
                }
            };

            applyColors(tree);

            // Save current state
            if (this.rootData) {
                this.pushUndo();
            }

            // Ensure rightmost placeholder nodes
            this.rootData = this.wrapRootWithPlaceholder(tree);
            this.ensureRightmostPlaceholderNodes(this.rootData);
            
            // Clear custom connections
            this.customConnections = [];
            
            // Render the flowchart
            this.renderFlowchart(this.rootData);
            this.autosave();
            
            this.showNotification('Flowchart generated from AI tree!');
            
        } catch (error) {
            this.showNotification('Error parsing tree: ' + error.message);
        }
    }

    parseTreeDiagram(text) {
        const lines = text.split('\n')
            .map(line => line.replace(/\r$/, ''))
            .filter(line => line.trim());

        if (lines.length === 0) return null;

        const parsedLines = [];
        for (const line of lines) {
            const leadingSpaces = line.length - line.trimStart().length;
            const trimmed = line.trim();
            const bulletMatch = trimmed.match(/^[-*]\s+(.*)$/);
            const content = bulletMatch ? bulletMatch[1].trim() : trimmed.trim();

            if (!content) continue;
            parsedLines.push({ leadingSpaces, content });
        }

        if (parsedLines.length === 0) return null;

        const positiveIndents = parsedLines
            .map(item => item.leadingSpaces)
            .filter(count => count > 0);

        let indentUnit = 4;
        if (positiveIndents.length > 0) {
            let gcd = positiveIndents[0];
            for (const indent of positiveIndents.slice(1)) {
                let a = gcd;
                let b = indent;
                while (b) {
                    const remainder = a % b;
                    a = b;
                    b = remainder;
                }
                gcd = a;
            }
            if (gcd > 0) indentUnit = gcd;
        }

        const root = { name: '', color: '#00a67e' };
        const stack = [];

        for (const item of parsedLines) {
            const depth = item.leadingSpaces === 0 ? 0 : Math.round(item.leadingSpaces / indentUnit);
            const node = { name: item.content, color: '#00a67e' };

            while (stack.length > 0 && stack[stack.length - 1].depth >= depth) {
                stack.pop();
            }

            if (stack.length === 0) {
                root.name = node.name;
                root.children = root.children || [];
                if (!root.children.some(child => child.name === node.name)) {
                    root.children.push(node);
                }
                stack.push({ node, depth });
            } else {
                const parent = stack[stack.length - 1].node;
                if (!parent.children) parent.children = [];
                parent.children.push(node);
                stack.push({ node, depth });
            }
        }

        if (root.children && root.children.length === 1) {
            return root.children[0];
        }

        return root;
    }

    // ===== END AI IMPORT/EXPORT =====

    showExportPopup() {
        // Always snapshot current state before exporting
        this.saveCurrentFlowchart();
        this.exportTextarea.value = this.exportAllAsJSON();
        this.exportPopup.style.display = 'block';
        this.exportTextarea.select();
        
        if (!document.getElementById('open-file-export-btn')) {
            const buttonContainer = this.exportPopup.querySelector('div:last-child');
            const openFileBtn = document.createElement('button');
            openFileBtn.id = 'open-file-export-btn';
            openFileBtn.textContent = 'Open Text File';
            openFileBtn.style.cssText = 'font-size:15px; padding:6px 18px; border:1px solid #aaa; border-radius:5px; background:#e0f0ff; cursor:pointer; margin-right:8px;';
            openFileBtn.addEventListener('click', () => this.openFileForExport());
            buttonContainer.insertBefore(openFileBtn, buttonContainer.firstChild);
            
            const saveBtn = document.createElement('button');
            saveBtn.id = 'save-file-export-btn';
            saveBtn.textContent = 'Save to File';
            saveBtn.style.cssText = 'font-size:15px; padding:6px 18px; border:1px solid #aaa; border-radius:5px; background:#e0ffe0; cursor:pointer; margin-right:8px;';
            saveBtn.addEventListener('click', () => this.saveExportToFile());
            buttonContainer.insertBefore(saveBtn, buttonContainer.firstChild);
        }
    }
    
    openFileForExport() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.txt,.json,text/plain,application/json';
        input.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const content = e.target.result;
                    JSON.parse(content);
                    this.exportTextarea.value = content;
                    this.exportTextarea.select();
                    this.showNotification('File loaded successfully');
                } catch (error) {
                    alert('The file does not contain valid JSON content');
                }
            };
            reader.readAsText(file);
        });
        input.click();
    }
    
    saveExportToFile() {
        const content = this.exportTextarea.value;
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'flowcharts.txt';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        this.showNotification('File saved');
    }

    importFromText() {
        const text = this.importTextarea.value;
        if (!text.trim()) {
            alert("Paste exported JSON to import.");
            return;
        }
        try {
            const importedData = JSON.parse(text);
            
            let flowchartsToImport = [];
            if (Array.isArray(importedData)) {
                flowchartsToImport = importedData;
            } else if (importedData.tree) {
                flowchartsToImport = [{
                    title: `Imported Flowchart ${this.flowchartList.length + 1}`,
                    data: text
                }];
            } else {
                throw new Error("Invalid format. Expected array of flowcharts or a single flowchart.");
            }
            
            flowchartsToImport = flowchartsToImport.filter(item => item && item.data);
            
            if (flowchartsToImport.length === 0) {
                alert("No valid flowcharts found in the import data.");
                return;
            }
            
            let saveCurrent = false;
            if (this.currentSlotIndex !== null && this.flowchartList[this.currentSlotIndex]) {
                saveCurrent = confirm("Save the current flowchart before importing?");
            }
            
            if (saveCurrent) {
                this.saveCurrentFlowchart();
            }
            
            // Do NOT reload from localStorage here - we work against the in-memory list
            // so dedup and index adjustments stay consistent
            
            let addedCount = 0;
            flowchartsToImport.forEach(item => {
                try {
                    JSON.parse(item.data);
                    const incomingTitle = item.title || `Imported Flowchart ${this.flowchartList.length + 1}`;

                    // Remove any existing flowchart with the same title
                    const dupeIdx = this.flowchartList.findIndex(f => f.title === incomingTitle);
                    if (dupeIdx !== -1) {
                        this.flowchartList.splice(dupeIdx, 1);
                        // Adjust currentSlotIndex after removal
                        if (this.currentSlotIndex === dupeIdx) {
                            this.currentSlotIndex = null;
                        } else if (this.currentSlotIndex !== null && this.currentSlotIndex > dupeIdx) {
                            this.currentSlotIndex--;
                        }
                    }

                    this.flowchartList.push({
                        title: incomingTitle,
                        data: item.data
                    });
                    addedCount++;
                } catch (e) {
                    console.warn('Skipping invalid flowchart entry:', e);
                }
            });
            
            this.saveFlowchartList();
            this.importPopup.style.display = 'none';
            
            if (addedCount > 0) {
                const newIndex = this.flowchartList.length - addedCount;
                this.loadFlowchartFromList(newIndex);
                this.autosave();
                this.showNotification(`Imported ${addedCount} flowchart(s)!`);
            } else {
                this.showNotification('No valid flowcharts were imported.');
            }
            
        } catch (e) {
            alert("Failed to import. Make sure the format is correct: " + e.message);
        }
    }

    showImportPopup() {
        this.importTextarea.value = '';
        this.importPopup.style.display = 'block';
        this.importTextarea.focus();
        
        if (!document.getElementById('open-file-import-btn')) {
            const buttonContainer = this.importPopup.querySelector('div:last-child');
            const openFileBtn = document.createElement('button');
            openFileBtn.id = 'open-file-import-btn';
            openFileBtn.textContent = 'Open Text File';
            openFileBtn.style.cssText = 'font-size:15px; padding:6px 18px; border:1px solid #aaa; border-radius:5px; background:#e0f0ff; cursor:pointer; margin-right:8px;';
            openFileBtn.addEventListener('click', () => this.openFileForImport());
            buttonContainer.insertBefore(openFileBtn, buttonContainer.firstChild);
        }
    }
    
    openFileForImport() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.txt,.json,text/plain,application/json';
        input.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = (e) => {
                this.importTextarea.value = e.target.result;
                this.showNotification('File loaded for import');
            };
            reader.readAsText(file);
        });
        input.click();
    }

    parseIndentedText(text) {
        const lines = text.split('\n').filter(line => line.trim().length > 0);
        const rootStack = [];
        let root = null;
        let prevDepth = -1;
        for (let i = 0; i < lines.length; ++i) {
            const line = lines[i];
            const match = line.match(/^(\s*)(.*)$/);
            const depth = Math.floor(match[1].length / 2);
            const name = match[2].trim();
            const node = { name };
            if (depth === 0) {
                root = node;
                rootStack.length = 0;
                rootStack.push(node);
            } else {
                while (rootStack.length > depth) rootStack.pop();
                const parent = rootStack[rootStack.length - 1];
                if (!parent.children) parent.children = [];
                parent.children.push(node);
                rootStack.push(node);
            }
            prevDepth = depth;
        }
        if (!root) throw new Error("No root node found");
        return root;
    }

    getConnectionOffset(conn) {
        if (!conn._offset) conn._offset = 0;
        return conn._offset;
    }
    setConnectionOffset(conn, offset) {
        conn._offset = offset;
    }

    moveSelectedConnection(dx) {
        if (!this.selectedConnection) return;
        this.pushUndo();
        this.setConnectionOffset(this.selectedConnection, this.getConnectionOffset(this.selectedConnection) + dx);
        this.renderFlowchart(this.rootData);
        setTimeout(() => this.selectConnectionByData(this.selectedConnection), 0);
        this.autosave();
    }

    selectConnectionByData(conn) {
        this.selectedConnection = conn;
        this.connectionControlsRow.style.display = 'flex';
        this.connectionControls.style.display = 'flex';
        d3.selectAll('.custom-link').classed('selected', d => d === conn);
    }

    deselectConnection() {
        this.selectedConnection = null;
        this.connectionControlsRow.style.display = 'none';
        this.connectionControls.style.display = 'none';
        d3.selectAll('.custom-link').classed('selected', false);
    }

    selectNode(d) {
        this.selectedNode = d;
        this.nodeControlsRow.style.display = 'none';
        this.nodeControlsRow.innerHTML = '';
    }
    deselectNode() {
        this.selectedNode = null;
        this.nodeControlsRow.style.display = 'none';
        this.nodeControlsRow.innerHTML = '';
        this.refreshRadialButtons();
    }
    deleteSelectedNode() {
        // No-op since delete node button is removed
    }

    deleteSelectedConnection() {
        if (!this.selectedConnection) return;
        this.pushUndo();
        this.customConnections = this.customConnections.filter(conn => conn !== this.selectedConnection);
        this.deselectConnection();
        this.renderFlowchart(this.rootData);
        this.autosave();
    }

    syncTransform() {
        const oldSvg = this.flowchartContainer.querySelector('svg');
        if (oldSvg) {
            this.transform = d3.zoomTransform(oldSvg);
        }
    }

    renderFlowchart(data, options = {}) {
        const self = this;
        const { fitView = false, keepTransform = false } = options;
        if (fitView) {
            this.transform = d3.zoomIdentity;
        } else if (!keepTransform) {
            this.syncTransform();
        }
        this.rootData = this.wrapRootWithPlaceholder(data);
        this.ensureRightmostPlaceholderNodes(this.rootData);
        
        const contentRoot = this.rootData.children && this.rootData.children.length > 0
            ? this.rootData.children[0]
            : this.rootData;
        this.ensureRightmostPlaceholderNodes(contentRoot);
        
        const rootHierarchy = d3.hierarchy(this.rootData);
        this.updateSimplifyPrefixes(rootHierarchy);
        
        this.flowchartContainer.innerHTML = '';

        const width = this.flowchartPanel.clientWidth;
        const height = this.flowchartPanel.clientHeight;

        const svg = d3.select('#flowchart')
            .append('svg')
            .attr('width', width)
            .attr('height', height)
            .attr('viewBox', `0 0 ${width} ${height}`);

        const g = svg.append('g');

        this.setupZoom(svg, g);

        const childrenAccessor = d => {
            if (d._collapsed) return null;
            if (!d.children) return null;
            // The root placeholder (the tree's own top node) is never filtered here since this
            // accessor only ever hides *children* of a node, never the node passed in as root.
            if (this.showPlaceholders) return d.children;
            return d.children.filter(child => !this.isPlaceholderNodeData(child) && (child.name || '').trim());
        };
        const root = d3.hierarchy(this.rootData, childrenAccessor);

        if (this.arrangement === 'indented') {
            const secondarySpacing = this.orientation === 'LR' ? this.lrNodeSpacing : this.tbHorizontalSpacing;
            const primarySpacing = this.orientation === 'LR' ? 160 : this.tbVerticalSpacing;
            this.applyIndentedLayout(root, secondarySpacing, primarySpacing);
        } else {
            const treeLayout = d3.tree()
                .nodeSize(this.orientation === 'LR' ? [this.lrNodeSpacing, 160] : [this.tbHorizontalSpacing, this.tbVerticalSpacing])
                // By default d3 doubles the separation between nodes that don't share a parent,
                // which is what makes the gap between two sibling trees (measured leaf-to-leaf)
                // balloon far past the gap between plain childless siblings. Using a uniform
                // separation keeps every pair of adjacent nodes at the same minimum distance,
                // whether they're true siblings or the closest edges of two neighboring subtrees.
                .separation(() => 1);
            treeLayout(root);
        }

        if (this.orientation === 'LR') {
            root.each(node => {
                const temp = node.x;
                node.x = node.y;
                node.y = temp;
            });
        }

        const cornerRadius = 10;
        g.append('g')
            .selectAll('path')
            .data(root.links())
            .enter()
            .append('path')
            .attr('class', 'link')
            .attr('d', d => {
                const snap10 = v => Math.round(v / 10) * 10;
                const sourceX = snap10(d.source.x);
                const sourceY = snap10(d.source.y);
                const targetX = snap10(d.target.x);
                const targetY = snap10(d.target.y);

                if (this.orientation === 'LR') {
                    // Any link whose source and target sit at the same height gets a plain
                    // horizontal line. This covers a lone child, an odd-count symmetric middle
                    // child under the centered layout, AND the first child under the indented
                    // layout (which is deliberately kept flush with its parent's row) - so the
                    // parent-to-first-child segment is a straight line rather than the mismatched
                    // up/down curve pair that appeared when sourceY and targetY were nearly
                    // equal but not treated as a straight case.
                    const isStraightLink = Math.abs(sourceY - targetY) < 1;

                    if (isStraightLink) {
                        return `M ${sourceX},${sourceY} L ${targetX},${targetY}`;
                    }

                    const dir = Math.sign(targetX - sourceX) || 1;
                    const connectionX = snap10(sourceX + dir * 80);
                    const yDirection = sourceY < targetY ? 1 : -1;
                    const curveStartY = sourceY + yDirection * cornerRadius;
                    const curveEndY = targetY - yDirection * cornerRadius;
                    return `
                        M ${sourceX},${sourceY}
                        L ${connectionX - dir * cornerRadius},${sourceY}
                        Q ${connectionX},${sourceY} ${connectionX},${curveStartY}
                        L ${connectionX},${curveEndY}
                        Q ${connectionX},${targetY} ${connectionX + dir * cornerRadius},${targetY}
                        L ${targetX},${targetY}
                    `;
                }

                const dir = Math.sign(targetX - sourceX) || 1;
                if (sourceX === targetX) {
                    return `M ${sourceX},${sourceY} L ${targetX},${targetY}`;
                }
                const connectionY = snap10(targetY - 80);
                return `
                    M ${sourceX},${sourceY}
                    L ${sourceX},${connectionY - cornerRadius}
                    Q ${sourceX},${connectionY} ${sourceX + dir * cornerRadius},${connectionY}
                    L ${targetX - dir * cornerRadius},${connectionY}
                    Q ${targetX},${connectionY} ${targetX},${connectionY + cornerRadius}
                    L ${targetX},${targetY}
                `;
            });

        if (this.customConnections.length > 0) {
            const nodeMap = new Map();
            root.each(d => {
                nodeMap.set(d.data, d);
            });

            this.customConnections = this.customConnections.filter(conn => {
                return nodeMap.has(conn.source) && nodeMap.has(conn.target);
            });

            const customLinksGroup = g.append('g');

            const verticalEntry = 80;
            const fillet = 10;

            customLinksGroup
                .selectAll('.custom-link-hit')
                .data(this.customConnections)
                .enter()
                .append('path')
                .attr('class', 'custom-link-hit')
                .attr('d', d => {
                    const snap10 = v => Math.round(v / 10) * 10;
                    const source = nodeMap.get(d.source);
                    const target = nodeMap.get(d.target);
                    if (!source || !target) return '';
                    const offset = this.getConnectionOffset(d);
                    const sourceX = snap10(source.x);
                    const sourceY = snap10(source.y);
                    const targetX = snap10(target.x);
                    const targetY = snap10(target.y);
                    const elbowY = snap10(sourceY + 50);
                    const elbowX = snap10(sourceX + offset - 10);
                    const entryY = snap10(targetY - verticalEntry);

                    let path = `M ${sourceX},${sourceY}`;
                    path += ` L ${sourceX},${elbowY - fillet}`;
                    path += ` Q ${sourceX},${elbowY} ${sourceX + Math.sign(offset) * fillet},${elbowY}`;
                    path += ` L ${elbowX - Math.sign(offset) * fillet},${elbowY}`;
                    path += ` Q ${elbowX},${elbowY} ${elbowX},${elbowY + fillet}`;
                    path += ` L ${elbowX},${entryY - fillet}`;
                    path += ` Q ${elbowX},${entryY} ${elbowX + Math.sign(targetX - elbowX) * fillet},${entryY}`;
                    path += ` L ${targetX - Math.sign(targetX - elbowX) * fillet},${entryY}`;
                    path += ` Q ${targetX},${entryY} ${targetX},${entryY + fillet}`;
                    path += ` L ${targetX},${targetY}`;
                    return path;
                })
                .style('fill', 'none')
                .style('stroke', 'rgba(0,0,0,0)')
                .style('stroke-width', 18)
                .style('cursor', 'pointer')
                .on('click', (event, d) => {
                    event.stopPropagation();
                    if (this.selectedConnection === d) {
                        this.deselectConnection();
                    } else {
                        this.selectConnectionByData(d);
                    }
                });

            customLinksGroup
                .selectAll('.custom-link')
                .data(this.customConnections)
                .enter()
                .append('path')
                .attr('class', 'custom-link link')
                .classed('selected', d => d === this.selectedConnection)
                .attr('d', d => {
                    const snap10 = v => Math.round(v / 10) * 10;
                    const source = nodeMap.get(d.source);
                    const target = nodeMap.get(d.target);
                    if (!source || !target) return '';
                    const offset = this.getConnectionOffset(d);
                    const sourceX = snap10(source.x);
                    const sourceY = snap10(source.y);
                    const targetX = snap10(target.x);
                    const targetY = snap10(target.y);
                    const elbowY = snap10(sourceY + 50);
                    const elbowX = snap10(sourceX + offset);
                    const entryY = snap10(targetY - verticalEntry);

                    let path = `M ${sourceX},${sourceY}`;
                    path += ` L ${sourceX},${elbowY - fillet}`;
                    path += ` Q ${sourceX},${elbowY} ${sourceX + Math.sign(offset) * fillet},${elbowY}`;
                    path += ` L ${elbowX - Math.sign(offset) * fillet},${elbowY}`;
                    path += ` Q ${elbowX},${elbowY} ${elbowX},${elbowY + fillet}`;
                    path += ` L ${elbowX},${entryY - fillet}`;
                    path += ` Q ${elbowX},${entryY} ${elbowX + Math.sign(targetX - elbowX) * fillet},${entryY}`;
                    path += ` L ${targetX - Math.sign(targetX - elbowX) * fillet},${entryY}`;
                    path += ` Q ${targetX},${entryY} ${targetX},${entryY + fillet}`;
                    path += ` L ${targetX},${targetY}`;
                    return path;
                })
                .on('click', (event, d) => {
                    event.stopPropagation();
                    if (this.selectedConnection === d) {
                        this.deselectConnection();
                    } else {
                        this.selectConnectionByData(d);
                    }
                });

            d3.select('svg').on('click.deselectconn', (event) => {
                if (event.target.tagName === 'svg') {
                    this.deselectConnection();
                }
            });
        } else {
            d3.select('svg').on('click.deselectconn', null);
            this.deselectConnection();
        }

        const node = g.append('g')
            .selectAll('.node')
            .data(root.descendants())
            .enter()
            .append('g')
            .attr('class', 'node')
            .attr('transform', d => {
                const snap10 = v => Math.round(v / 10) * 10;
                return `translate(${snap10(d.x)},${d.y})`;
            })
            .on('mousedown', (event, d) => {
                if (event.button === 0 && event.ctrlKey) {
                    this.startCtrlDragNode(event, d);
                }
            })
            .on('click', (event, d) => {
                if (event.button === 0) {
                    if (this.skipNextNodeClick) {
                        this.skipNextNodeClick = false;
                        return;
                    }
                    event.stopPropagation();
                    this.centerNodeOnMobile(d, () => {
                        this.showNodeEditPopup(d);
                        this.selectNode(d);
                        this.refreshRadialButtons();
                    });
                }
            })
            .on('dblclick', (event, d) => {
                event.stopPropagation();
                if (d && d.data && d.data.children && d.data.children.length > 0) {
                    this.toggleNodeCollapse(d);
                }
            })
            .on('contextmenu', (event, d) => {
                event.preventDefault();
                this.showNodeEditPopup(d);
                this.selectNode(d);
                this.refreshRadialButtons();
            });

        const NODE_WIDTH = 120;
        const LINE_HEIGHT = 18;
        const PADDING_Y = 12;
        const FONT_SIZE = 13;
        const FONT_FAMILY = 'Arial, sans-serif';

        function measureTextWidth(text) {
            const svg = d3.select('body').append('svg').attr('style', 'position:absolute;left:-9999px;top:-9999px');
            const tempText = svg.append('text')
                .attr('font-size', FONT_SIZE)
                .attr('font-family', FONT_FAMILY)
                .text(text);
            const width = tempText.node().getComputedTextLength();
            svg.remove();
            return width;
        }

        node.each(function(d) {
            const rawName = d.data.name || '';
            if (rawName) {
                d.data.name = rawName.replace(/^\s*\S/, ch => ch.toUpperCase());
            }
            const words = d.data.name.split(/(\s+)/);
            let lines = [];
            let current = '';
            words.forEach(word => {
                const testLine = (current + word).trim();
                if (testLine && measureTextWidth(testLine) > NODE_WIDTH - 16) {
                    if (current) lines.push(current.trim());
                    current = word.trim();
                } else {
                    current += word;
                }
            });
            if (current.trim()) lines.push(current.trim());
            d._lines = lines.length ? lines : [d.data.name || ''];
        });

        node.append('rect')
        .attr('width', NODE_WIDTH)
        .attr('height', d => d._lines.length * LINE_HEIGHT + PADDING_Y)
        .attr('x', -NODE_WIDTH/2)
        .attr('y', d => -((d._lines.length * LINE_HEIGHT + PADDING_Y)/2))
        .attr('fill', d => {
            if (this.isPlaceholderNodeData(d.data) || !(d.data.name || '').trim()) {
                return this.getPlaceholderColor();
            }
            const sourceNodes = new Set(this.customConnections.map(conn => conn.source));
            const hasHierarchicalChildren = d.children && d.children.length > 0;
            const hasCustomConnections = sourceNodes.has(d.data);
            const isParentNode = hasHierarchicalChildren || hasCustomConnections;
            if (isParentNode) {
                return d.data.color || '#00a67e';
            }
            return d.data.color || '#00a67e';
        })
        .attr('stroke', d => {
            if (this.isPlaceholderNodeData(d.data) || !(d.data.name || '').trim()) {
                return this.getPlaceholderColor();
            }
            return d.data._collapsed ? '#ffcc00' : '#999';
        })
        .attr('stroke-width', d => {
            if (this.isPlaceholderNodeData(d.data) || !(d.data.name || '').trim()) {
                return '0';
            }
            return d.data._collapsed ? '3px' : '1.5px';
        });

        node.append('text')
        .attr('text-anchor', 'middle')
        .attr('font-size', FONT_SIZE)
        .attr('font-weight', 'bold')
        .attr('fill', d => {
            if (this.isPlaceholderNodeData(d.data) || !(d.data.name || '').trim()) {
                return this.getPlaceholderColor();
            }
            const fill = d.data.color || '#00a67e';
            function hexToRgb(hex) {
                if (!hex) return { r: 0, g: 0, b: 0 };
                if (hex[0] === '#') hex = hex.slice(1);
                if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
                const int = parseInt(hex, 16);
                return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
            }
            const { r, g, b } = hexToRgb(fill);
            const brightness = (r * 299 + g * 587 + b * 114) / 1000;
            return brightness > 150 ? '#000000' : '#ffffff';
        })
        .selectAll('tspan')
        .data(d => d._lines.map((line, i, arr) => ({
            line,
            y: (i - (arr.length-1)/2) * LINE_HEIGHT + 4,
            isLast: i === arr.length - 1,
            collapsed: d.data._collapsed
        })))
        .enter()
        .append('tspan')
        .attr('x', 0)
        .attr('y', d => d.y)
        .text(d => d.line);

        const collapseArrowOrientation = this.orientation;
        node.each(function(d) {
            if (d.data._collapsed) {
                const text = d3.select(this).select('text');
                if (collapseArrowOrientation === 'LR') {
                    // Children extend to the right in LR mode, so the fold/unfold
                    // indicator sits just outside the node's right edge instead of below it.
                    text.append('tspan')
                        .attr('x', NODE_WIDTH / 2 + 16)
                        .attr('y', 4)
                        .attr('fill', '#ffffff')
                        .attr('font-size', FONT_SIZE + 3)
                        .text('▶');
                } else {
                    text.append('tspan')
                        .attr('x', 0)
                        .attr('y', d._lines.length * LINE_HEIGHT / 2 + 25)
                        .attr('fill', '#ffffff')
                        .attr('font-size', FONT_SIZE + 3)
                        .text('▼');
                }
            }
        });

        const isIdentity = (t) => t.k === 1 && t.x === 0 && t.y === 0;
        if (fitView || isIdentity(this.transform)) {
            const bounds = g.node().getBBox();
            const scale = 0.9 / Math.max(bounds.width / width, bounds.height / height);
            const tx = (width - bounds.width * scale) / 2 - bounds.x * scale;
            const ty = (height - bounds.height * scale) / 2 - bounds.y * scale;
            this.transform = d3.zoomIdentity.translate(tx, ty).scale(scale);
            g.attr('transform', this.transform);
            svg.call(this._zoomBehavior.transform, this.transform);
        } else {
            g.attr('transform', this.transform);
        }

        this.updateUndoRedoButtons();
        this.refreshRadialButtons();
    }

    // Floating quick-add buttons around the currently selected node: left/right add a
    // sibling on that side, below adds a child, above adds a new parent (same action as
    // the "Add Parent" button in the edit popup). Rebuilt on demand rather than kept in
    // sync incrementally, since selection changes and re-renders are both infrequent
    // relative to normal interaction.
    refreshRadialButtons() {
        d3.selectAll('.radial-add-btn-layer').remove();
        if (!this.selectedNode) return;

        const selectedData = this.selectedNode.data;
        if (!selectedData) return;

        const nodeEls = d3.selectAll('#flowchart .node');
        if (nodeEls.empty()) return;
        const containerEl = nodeEls.node().parentNode;
        if (!containerEl) return;
        const container = d3.select(containerEl);

        let targetDatum = null;
        nodeEls.each(function(d) {
            if (d && d.data === selectedData) targetDatum = d;
        });
        if (!targetDatum) return;

        const NODE_WIDTH = 120;
        const LINE_HEIGHT = 18;
        const PADDING_Y = 12;
        const btnWidth = 52;
        const btnHeight = 40;
        const btnClearance = 20;
        const btnSpacing = 10;
        const horizGap = btnClearance + btnWidth / 2;
        const vertGap = btnClearance + btnHeight / 2;
        const DANGER_TEXT = '#ff6b6b';
        const self = this;
        const snap10 = v => Math.round(v / 10) * 10;

        const baseX = snap10(targetDatum.x);
        const baseY = targetDatum.y;
        const lineCount = (targetDatum._lines && targetDatum._lines.length) || 1;
        const halfHeight = (lineCount * LINE_HEIGHT + PADDING_Y) / 2;

        // Appended last, to the same container that holds every node - not nested inside
        // the selected node's own <g> - so this layer always paints on top of neighboring
        // nodes (e.g. a sibling sitting right where the right-hand button goes) instead of
        // being hidden behind whichever node happens to come later in the draw order.
        const btnLayer = container.append('g').attr('class', 'radial-add-btn-layer');

        const makeRadialBtn = (dx, dy, label, onActivate, danger = false, fontSize = 26) => {
            const btnGroup = btnLayer.append('g')
                .attr('class', 'radial-add-btn')
                .attr('transform', `translate(${baseX + dx},${baseY + dy})`)
                .style('cursor', 'pointer')
                .on('mousedown', (event) => event.stopPropagation())
                .on('touchstart', (event) => event.stopPropagation())
                .on('click', (event) => {
                    event.stopPropagation();
                    onActivate();
                });
            btnGroup.append('rect')
                .attr('x', -btnWidth / 2)
                .attr('y', -btnHeight / 2)
                .attr('width', btnWidth)
                .attr('height', btnHeight)
                .attr('rx', 8)
                .attr('ry', 8)
                .style('fill', 'var(--bg)')
                .attr('stroke', 'none');
            btnGroup.append('text')
                .attr('text-anchor', 'middle')
                .attr('dominant-baseline', 'central')
                .attr('fill', danger ? DANGER_TEXT : '#e6eef8')
                .attr('font-size', fontSize)
                .attr('font-weight', 'bold')
                .attr('y', 1)
                .text(label);
        };

        // After a button spawns a new node, move the radial buttons onto that new node
        // instead of leaving them on the original one.
        const focusNewNode = (newData, afterCenter) => {
            if (!newData) return null;
            let found = null;
            d3.hierarchy(self.rootData).each(node => {
                if (node.data === newData) found = node;
            });
            if (found) {
                const renderedNode = self.findRenderedNode(newData) || found;
                self.centerNodeOnMobile(renderedNode, () => {
                    self.selectNode(found);
                    self.refreshRadialButtons();
                    if (afterCenter) afterCenter(found);
                });
            }
            return found;
        };

        const activateAddChild = () => {
            const newChild = self.addChildNode(targetDatum);
            focusNewNode(newChild, (found) => {
                self.showNodeEditPopup(found);
                self.nodeEditInput.value = '';
                self.resizeNodeEditInput();
                self.nodeEditInput.focus();
            });
        };
        const activateAddParent = () => {
            const newParentData = self.addParentNode(targetDatum);
            focusNewNode(newParentData);
        };
        const activateAddSiblingBefore = () => focusNewNode(self.addSiblingNode(targetDatum, -1));
        const activateAddSiblingAfter = () => focusNewNode(self.addSiblingNode(targetDatum, 1));
        const activateMoveLeft = () => self.moveNodeInSiblings(targetDatum, -1);
        const activateMoveRight = () => self.moveNodeInSiblings(targetDatum, 1);
        const activateMove = () => {
            self.hideNodeEditPopup();
            self.deselectNode();
            self.startMoveNode(targetDatum);
        };
        const activateDelete = () => {
            self.hideNodeEditPopup(false);
            self.selectedNode = null;
            self.deleteNode(targetDatum);
        };
        const activateDeleteAndPromote = () => {
            self.hideNodeEditPopup(false);
            self.selectedNode = null;
            self.deleteNodeAndPromoteChildren(targetDatum);
        };

        const activateMakeConnection = () => {
            self.hideNodeEditPopup();
            self.deselectNode();
            self.startMakeConnection(targetDatum);
        };

        // Fold/unfold, driven by a dedicated button rather than relying on double-click
        // (which is unreliable on mobile once a tap has re-centered the view - the
        // second tap can land on a different element and the browser never fires
        // dblclick at all). Keeps the node selected so the row stays open afterward.
        const canFold = Boolean(targetDatum.data.children && targetDatum.data.children.length > 0);
        const activateFold = () => self.toggleNodeCollapse(targetDatum, true);

        // The "top" +button sits at the same offset in both orientations (see below), so
        // the delete-row above it can be positioned once, independent of orientation.
        const topPlusDy = -(halfHeight + vertGap);
        const deleteRowDy = topPlusDy - (btnHeight + btnSpacing);

        // Built as a list and evenly spaced around dx=0 so the row is always centered
        // as a whole, whatever combination of buttons ends up in it - rather than each
        // button having a hardcoded offset (which is what made the row look lopsided
        // before). F (fold) always sits immediately left of C (make connection).
        const deleteRowBtns = [];
        if (canFold) deleteRowBtns.push({ label: 'F', activate: activateFold });
        deleteRowBtns.push({ label: 'C', activate: activateMakeConnection });
        deleteRowBtns.push({ label: 'M', activate: activateMove });
        if (targetDatum.parent) {
            deleteRowBtns.push({ label: '✕', activate: activateDelete, danger: true, fontSize: 22 });
            deleteRowBtns.push({ label: 'P', activate: activateDeleteAndPromote, danger: true, fontSize: 20 });
        }
        const rowUnit = btnWidth + btnSpacing;
        const rowCount = deleteRowBtns.length;
        deleteRowBtns.forEach((btn, i) => {
            const dx = (i - (rowCount - 1) / 2) * rowUnit;
            makeRadialBtn(dx, deleteRowDy, btn.label, btn.activate, Boolean(btn.danger), btn.fontSize || 26);
        });

        if (this.orientation === 'LR') {
            // Children extend to the right and parents sit to the left in this
            // orientation, so the horizontal buttons follow that flow: left adds a new
            // parent, right adds a child. Siblings stack vertically, so they move to
            // the top/bottom buttons instead of left/right.
            makeRadialBtn(-(NODE_WIDTH / 2 + horizGap), 0, '+', activateAddParent);
            makeRadialBtn(NODE_WIDTH / 2 + horizGap, 0, '+', activateAddChild);
            if (targetDatum.parent) {
                makeRadialBtn(0, topPlusDy, '+', activateAddSiblingBefore);
                makeRadialBtn(0, halfHeight + vertGap, '+', activateAddSiblingAfter);
                makeRadialBtn(-(btnWidth + btnSpacing), topPlusDy, '◀', activateMoveLeft);
                makeRadialBtn(btnWidth + btnSpacing, halfHeight + vertGap, '▶', activateMoveRight);
            }
        } else {
            if (targetDatum.parent) {
                makeRadialBtn(-(NODE_WIDTH / 2 + horizGap), 0, '+', activateAddSiblingBefore);
                makeRadialBtn(NODE_WIDTH / 2 + horizGap, 0, '+', activateAddSiblingAfter);
                makeRadialBtn(-(NODE_WIDTH / 2 + horizGap) - (btnWidth + btnSpacing), 0, '◀', activateMoveLeft);
                makeRadialBtn(NODE_WIDTH / 2 + horizGap + (btnWidth + btnSpacing), 0, '▶', activateMoveRight);
            }
            makeRadialBtn(0, halfHeight + vertGap, '+', activateAddChild);
            makeRadialBtn(0, topPlusDy, '+', activateAddParent);
        }
    }

    showNotification(message, duration = 3000) {
        const notif = document.createElement('div');
        notif.className = 'flowchart-notification';
        notif.textContent = message;
        Object.assign(notif.style, {
            position: 'fixed',
            right: '20px',
            bottom: '20px',
            background: 'rgba(0,0,0,0.85)',
            color: '#fff',
            padding: '10px 14px',
            borderRadius: '6px',
            zIndex: 9999,
            boxShadow: '0 6px 18px rgba(0,0,0,0.3)',
            opacity: '1',
            transition: 'opacity 300ms ease',
            maxWidth: '400px'
        });
        document.body.appendChild(notif);
        setTimeout(() => {
            notif.style.opacity = '0';
            setTimeout(() => {
                try { notif.remove(); } catch (e) {}
            }, 300);
        }, duration);
    }
}

// Initialize the viewer when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new FlowchartViewer();
});
