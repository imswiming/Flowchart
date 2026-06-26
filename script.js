class FlowchartViewer {
    constructor() {
        this.flowchartContainer = document.getElementById('flowchart');
        this.flowchartPanel = document.getElementById('flowchart-panel');
        this.zoomInBtn = document.getElementById('zoom-in');
        this.zoomOutBtn = document.getElementById('zoom-out');
        this.resetZoomBtn = document.getElementById('reset-zoom');
        this.resetViewBtn = document.getElementById('reset-view');
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
        this.zoomInBtn.addEventListener('click', () => this.zoom(1 + this.zoomStep));
        this.zoomOutBtn.addEventListener('click', () => this.zoom(1 - this.zoomStep));
        this.resetZoomBtn.addEventListener('click', () => this.resetZoom());
        this.resetViewBtn.addEventListener('click', () => this.resetView());
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

        // Node edit popup handlers
        this.nodeEditForm.addEventListener('submit', (e) => {
            e.preventDefault();
            // Do nothing on enter, let blur or background click handle save
        });

        // Initial flowchart render with sample data
        this.renderFlowchart(this.getSampleData());
        this.currentSlotIndex = 0;
        this.saveCurrentFlowchart();

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

    // Save current flowchart to the list
    saveCurrentFlowchart() {
        if (this.currentSlotIndex === null) return;
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
    }

    // Autosave wrapper - call after any edit
    autosave() {
        this.saveCurrentFlowchart();
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
        
        const defaultData = {
            name: "New Flowchart",
            children: [
                { name: "Start" }
            ]
        };
        
        this.flowchartList.push({
            title: `Flowchart ${this.flowchartList.length + 1}`,
            data: JSON.stringify({
                tree: defaultData,
                customConnections: []
            })
        });
        
        this.currentSlotIndex = this.flowchartList.length - 1;
        this.saveFlowchartList();
        
        if (this.currentSlotIndex !== null && this.flowchartList[this.currentSlotIndex]) {
            this.saveCurrentFlowchart();
        }
        
        this.customConnections = [];
        this.rootData = defaultData;
        this.transform = d3.zoomIdentity;
        this._zoomBehavior = null;
        
        this.renderFlowchart(this.rootData);
        this.currentSlotIndex = this.flowchartList.length - 1;
        this.saveCurrentFlowchart();
        
        this.storagePopup.style.display = 'none';
        this.showNotification('New flowchart created!');
    }
    
    loadFlowchartFromList(index) {
        if (index >= this.flowchartList.length) return;
        
        if (this.currentSlotIndex !== null && this.flowchartList[this.currentSlotIndex]) {
            this.saveCurrentFlowchart();
        }
        
        const item = this.flowchartList[index];
        if (!item || !item.data) return;
        
        try {
            const parsed = JSON.parse(item.data);
            if (parsed.tree) {
                this.pushUndo();
                this.transform = d3.zoomIdentity;
                this._zoomBehavior = null;
                
                let treeData = parsed.tree;
                if (this.isPlaceholderNodeData(treeData) || 
                    (treeData.name === '' && treeData.color === this.getPlaceholderColor() && treeData.children && treeData.children.length > 0)) {
                    this.rootData = treeData;
                } else {
                    this.rootData = this.wrapRootWithPlaceholder(treeData);
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
                    
                    this.renderFlowchart(this.rootData);
                }
                
                this.renderFlowchart(this.rootData);
                this.currentSlotIndex = index;
                this.saveCurrentFlowchart();
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
                .on('zoom', (event) => {
                    this.transform = event.transform;
                    d3.select('#flowchart g').attr('transform', this.transform);
                    this.hideContextMenu();
                    this.hideNodeEditPopup(true);
                });
        }

        svg.call(this._zoomBehavior);
        svg.call(this._zoomBehavior.transform, this.transform);

        svg.on('dblclick.zoom', null);
        svg.on('dblclick', () => this.resetZoom());

        svg.on('click', (event) => {
            if (event.target === svg.node()) {
                this.hideContextMenu();
                this.hideNodeEditPopup(true);
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

    resetView() {
        this.transform = d3.zoomIdentity;
        this._zoomBehavior = null;
        this.updateFlowchart();
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
        if (this.isPlaceholderNodeData(nodeData)) return;

        if (!Array.isArray(nodeData.children) || nodeData.children.length === 0) {
            return;
        }

        nodeData.children.forEach(child => {
            this.ensureRightmostPlaceholderNodes(child);
        });

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
        const newChild = { name: newName };
        d.data.children.push(newChild);
        this.renderFlowchart(this.rootData);
        this.updateUndoRedoButtons();
        this.autosave();
        return newChild;
    }

    addParentNode(d) {
        this.pushUndo();
        const oldData = d.data;
        const parent = d.parent;
        const newParent = { name: '' };
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
            this.showNodeEditPopup(found);
            this.nodeEditInput.value = '';
            this.nodeEditInput.focus();
            this.nodeEditInput.select();
        }
        this.updateUndoRedoButtons();
        this.autosave();
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
        let baseName = 'New Node';
        let idx = 1;
        const siblingNames = siblings.map(child => child.name);
        let newName = baseName;
        while (siblingNames.includes(newName)) {
            newName = `${baseName} ${idx++}`;
        }
        const newSibling = { name: newName };
        const idxPos = siblings.indexOf(d.data);
        const insertAt = direction < 0 ? idxPos : idxPos + 1;
        siblings.splice(insertAt, 0, newSibling);
        this.renderFlowchart(this.rootData);
        let found = null;
        d3.hierarchy(this.rootData).each(node => {
            if (node.data === newSibling) found = node;
        });
        if (found) this.showNodeEditPopup(found);
        this.updateUndoRedoButtons();
        this.autosave();
        return newSibling;
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

    showNodeEditPopup(d) {
        this.nodeBeingEdited = d;
        
        let displayName = d.data.name;
        if (this.isLeafNode(d) && this.isGreenNode(d)) {
            if (!displayName.endsWith(' (Simplify?)')) {
                displayName = displayName + ' (Simplify?)';
            }
        } else {
            if (displayName.endsWith(' (Simplify?)')) {
                displayName = displayName.substring(0, displayName.length - ' (Simplify?)'.length);
            }
        }
        
        this.nodeEditInput.value = displayName;
        this.nodeEditInput.focus();
        this.nodeEditInput.select();
        setTimeout(() => {
            try { this.nodeEditInput.select(); } catch (e) { /* ignore */ }
        }, 0);
        
        let nodeActionBtns = document.getElementById('node-action-btns');
        if (!nodeActionBtns) {
            nodeActionBtns = document.createElement('div');
            nodeActionBtns.id = 'node-action-btns';
            nodeActionBtns.style.display = 'flex';
            nodeActionBtns.style.gap = '10px';
            nodeActionBtns.style.marginBottom = '10px';
            nodeActionBtns.style.justifyContent = 'center';
            nodeActionBtns.style.flexWrap = 'wrap';
            
            const addChildBtn = document.createElement('button');
            addChildBtn.textContent = 'Add Child';
            addChildBtn.style.background = '#f0f0f0';
            addChildBtn.style.color = '#333';
            addChildBtn.style.border = '1px solid #aaa';
            addChildBtn.style.borderRadius = '5px';
            addChildBtn.style.padding = '6px 16px';
            addChildBtn.style.cursor = 'pointer';
            addChildBtn.onclick = () => {
                this.hideNodeEditPopup();
                const newChild = this.addChildNode(d);
                if (newChild) {
                    if (!this.isMovingNode) {
                        const root = d3.hierarchy(this.rootData);
                        let found = null;
                        root.each(node => {
                            if (node.data === newChild) found = node;
                        });
                        if (found) {
                            this.showNodeEditPopup(found);
                            this.nodeEditInput.value = '';
                            this.nodeEditInput.focus();
                        }
                    }
                }
            };
            
            const addParentBtn = document.createElement('button');
            addParentBtn.textContent = 'Add Parent';
            addParentBtn.style.background = '#f0f0f0';
            addParentBtn.style.color = '#333';
            addParentBtn.style.border = '1px solid #aaa';
            addParentBtn.style.borderRadius = '5px';
            addParentBtn.style.padding = '6px 16px';
            addParentBtn.style.cursor = 'pointer';
            addParentBtn.onclick = () => {
                this.hideNodeEditPopup();
                this.addParentNode(d);
            };
            
            const makeConnBtn = document.createElement('button');
            makeConnBtn.textContent = 'Make Connection';
            makeConnBtn.style.background = '#f0f0f0';
            makeConnBtn.style.color = '#333';
            makeConnBtn.style.border = '1px solid #aaa';
            makeConnBtn.style.borderRadius = '5px';
            makeConnBtn.style.padding = '6px 16px';
            makeConnBtn.style.cursor = 'pointer';
            makeConnBtn.onclick = () => {
                this.hideNodeEditPopup();
                this.startMakeConnection(d);
            };
            
            const duplicateBtn = document.createElement('button');
            duplicateBtn.textContent = 'Duplicate Node';
            duplicateBtn.style.background = '#f0f0f0';
            duplicateBtn.style.color = '#333';
            duplicateBtn.style.border = '1px solid #aaa';
            duplicateBtn.style.borderRadius = '5px';
            duplicateBtn.style.padding = '6px 16px';
            duplicateBtn.style.cursor = 'pointer';
            duplicateBtn.onclick = () => {
                this.hideNodeEditPopup();
                this.duplicateNodeToParentSiblings(d);
            };
            
            const deleteNodeBtn = document.createElement('button');
            deleteNodeBtn.textContent = 'Delete Node';
            deleteNodeBtn.style.background = '#f0f0f0';
            deleteNodeBtn.style.color = '#333';
            deleteNodeBtn.style.border = '1px solid #aaa';
            deleteNodeBtn.style.borderRadius = '5px';
            deleteNodeBtn.style.padding = '6px 16px';
            deleteNodeBtn.style.cursor = 'pointer';
            deleteNodeBtn.onclick = () => {
                this.hideNodeEditPopup();
                this.deleteNode(d);
            };
            
            const deletePromoteBtn = document.createElement('button');
            deletePromoteBtn.textContent = 'Delete Node (Promote Children)';
            deletePromoteBtn.style.background = '#ffecec';
            deletePromoteBtn.style.color = '#900';
            deletePromoteBtn.style.border = '1px solid #ff9a9a';
            deletePromoteBtn.style.borderRadius = '5px';
            deletePromoteBtn.style.padding = '6px 14px';
            deletePromoteBtn.style.cursor = 'pointer';
            deletePromoteBtn.onclick = () => {
                this.hideNodeEditPopup();
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
            };
            
            nodeActionBtns.appendChild(addChildBtn);
            nodeActionBtns.appendChild(addParentBtn);
            nodeActionBtns.appendChild(makeConnBtn);
            nodeActionBtns.appendChild(duplicateBtn);
            nodeActionBtns.appendChild(deleteNodeBtn);
            nodeActionBtns.appendChild(deletePromoteBtn);
            this.nodeEditPopup.insertBefore(nodeActionBtns, this.nodeEditPopup.firstChild);

            const nodeSiblingBtns = document.createElement('div');
            nodeSiblingBtns.id = 'node-sibling-btns';
            nodeSiblingBtns.style.display = 'flex';
            nodeSiblingBtns.style.gap = '10px';
            nodeSiblingBtns.style.margin = '8px 0 6px 0';
            nodeSiblingBtns.style.justifyContent = 'center';
            nodeSiblingBtns.style.flexWrap = 'wrap';

            const addSiblingLeftBtn = document.createElement('button');
            addSiblingLeftBtn.textContent = 'Add Sibling Left';
            addSiblingLeftBtn.style.background = '#f0f0f0';
            addSiblingLeftBtn.style.color = '#333';
            addSiblingLeftBtn.style.border = '1px solid #aaa';
            addSiblingLeftBtn.style.borderRadius = '5px';
            addSiblingLeftBtn.style.padding = '6px 14px';
            addSiblingLeftBtn.style.cursor = 'pointer';
            addSiblingLeftBtn.onclick = () => {
                this.hideNodeEditPopup();
                this.addSiblingNode(d, -1);
            };

            const addSiblingRightBtn = document.createElement('button');
            addSiblingRightBtn.textContent = 'Add Sibling Right';
            addSiblingRightBtn.style.background = '#f0f0f0';
            addSiblingRightBtn.style.color = '#333';
            addSiblingRightBtn.style.border = '1px solid #aaa';
            addSiblingRightBtn.style.borderRadius = '5px';
            addSiblingRightBtn.style.padding = '6px 14px';
            addSiblingRightBtn.style.cursor = 'pointer';
            addSiblingRightBtn.onclick = () => {
                this.hideNodeEditPopup();
                this.addSiblingNode(d, 1);
            };

            nodeSiblingBtns.appendChild(addSiblingLeftBtn);
            nodeSiblingBtns.appendChild(addSiblingRightBtn);
            this.nodeEditPopup.insertBefore(nodeSiblingBtns, this.nodeEditPopup.firstChild);

            const nodeMoveBtns = document.createElement('div');
            nodeMoveBtns.id = 'node-move-btns';
            nodeMoveBtns.style.display = 'flex';
            nodeMoveBtns.style.gap = '10px';
            nodeMoveBtns.style.margin = '8px 0 12px 0';
            nodeMoveBtns.style.justifyContent = 'center';
            nodeMoveBtns.style.flexWrap = 'wrap';

            const moveBtn = document.createElement('button');
            moveBtn.textContent = 'Move';
            moveBtn.style.background = '#f0f0f0';
            moveBtn.style.color = '#333';
            moveBtn.style.border = '1px solid #aaa';
            moveBtn.style.borderRadius = '5px';
            moveBtn.style.padding = '6px 16px';
            moveBtn.style.cursor = 'pointer';
            moveBtn.onclick = () => {
                this.hideNodeEditPopup();
                this.startMoveNode(d);
            };

            const moveLeftBtn = document.createElement('button');
            moveLeftBtn.textContent = 'Move Left';
            moveLeftBtn.style.background = '#f8f8f8';
            moveLeftBtn.style.border = '1px solid #aaa';
            moveLeftBtn.style.borderRadius = '5px';
            moveLeftBtn.style.padding = '6px 12px';
            moveLeftBtn.style.cursor = 'pointer';
            moveLeftBtn.onclick = () => {
                this.hideNodeEditPopup();
                this.moveNodeInSiblings(d, -1);
            };

            const moveRightBtn = document.createElement('button');
            moveRightBtn.textContent = 'Move Right';
            moveRightBtn.style.background = '#f8f8f8';
            moveRightBtn.style.border = '1px solid #aaa';
            moveRightBtn.style.borderRadius = '5px';
            moveRightBtn.style.padding = '6px 12px';
            moveRightBtn.style.cursor = 'pointer';
            moveRightBtn.onclick = () => {
                this.hideNodeEditPopup();
                this.moveNodeInSiblings(d, 1);
            };

            nodeMoveBtns.appendChild(moveBtn);
            nodeMoveBtns.appendChild(moveLeftBtn);
            nodeMoveBtns.appendChild(moveRightBtn);
            this.nodeEditPopup.insertBefore(nodeMoveBtns, this.nodeEditPopup.firstChild);
        }
        
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
            greenBtn.onclick = () => {
                if (this.nodeBeingEdited) {
                    this.pushUndo();
                    if (this.isPlaceholderNodeData(this.nodeBeingEdited.data)) {
                        this.markNodeAsReal(this.nodeBeingEdited.data);
                    }
                    this.nodeBeingEdited.data.color = '#00a67e';
                    this.ensureRightmostPlaceholderNodes(this.rootData);
                    this.updateSimplifyPrefixes(d3.hierarchy(this.rootData));
                    this.renderFlowchart(this.rootData);
                    this.showNodeEditPopup(this.nodeBeingEdited);
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
            pinkBtn.onclick = () => {
                if (this.nodeBeingEdited) {
                    this.pushUndo();
                    if (this.isPlaceholderNodeData(this.nodeBeingEdited.data)) {
                        this.markNodeAsReal(this.nodeBeingEdited.data);
                    }
                    this.nodeBeingEdited.data.color = '#e75480';
                    if (!/^Assumption:\s/.test(this.nodeBeingEdited.data.name)) {
                        this.nodeBeingEdited.data.name = 'Assumption: ' + (this.nodeBeingEdited.data.name || '');
                    }
                    this.ensureRightmostPlaceholderNodes(this.rootData);
                    this.updateSimplifyPrefixes(d3.hierarchy(this.rootData));
                    this.renderFlowchart(this.rootData);
                    this.showNodeEditPopup(this.nodeBeingEdited);
                    this.nodeEditInput.value = this.nodeBeingEdited.data.name;
                    setTimeout(() => { try { this.nodeEditInput.select(); } catch (e) {} }, 0);
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
            blueBtn.onclick = () => {
                if (this.nodeBeingEdited) {
                    this.pushUndo();
                    if (this.isPlaceholderNodeData(this.nodeBeingEdited.data)) {
                        this.markNodeAsReal(this.nodeBeingEdited.data);
                    }
                    this.nodeBeingEdited.data.color = '#0074d9';
                    this.ensureRightmostPlaceholderNodes(this.rootData);
                    this.updateSimplifyPrefixes(d3.hierarchy(this.rootData));
                    this.renderFlowchart(this.rootData);
                    this.showNodeEditPopup(this.nodeBeingEdited);
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
            yellowBtn.onclick = () => {
                if (this.nodeBeingEdited) {
                    this.pushUndo();
                    if (this.isPlaceholderNodeData(this.nodeBeingEdited.data)) {
                        this.markNodeAsReal(this.nodeBeingEdited.data);
                    }
                    this.nodeBeingEdited.data.color = '#ffcc00';
                    this.ensureRightmostPlaceholderNodes(this.rootData);
                    this.updateSimplifyPrefixes(d3.hierarchy(this.rootData));
                    this.renderFlowchart(this.rootData);
                    this.showNodeEditPopup(this.nodeBeingEdited);
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
            emptyBtn.onclick = () => {
                if (this.nodeBeingEdited) {
                    this.pushUndo();
                    this.nodeBeingEdited.data.color = this.getPlaceholderColor();
                    this.nodeBeingEdited.data.name = '';
                    this.nodeBeingEdited.data._isPlaceholder = true;
                    this.ensureRightmostPlaceholderNodes(this.rootData);
                    this.updateSimplifyPrefixes(d3.hierarchy(this.rootData));
                    this.renderFlowchart(this.rootData);
                    this.showNodeEditPopup(this.nodeBeingEdited);
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
        if (found) this.showNodeEditPopup(found);
        this.autosave();
    }

    hideNodeEditPopup(save = true) {
        if (save) this.saveNodeEdit();
        this.nodeEditPopup.style.display = 'none';
        this.nodeBeingEdited = null;
        const colorBtns = document.getElementById('node-color-btns');
        if (colorBtns) colorBtns.remove();
        const moveBtns = document.getElementById('node-move-btns');
        if (moveBtns) moveBtns.remove();
        const nodeActionBtns = document.getElementById('node-action-btns');
        if (nodeActionBtns) nodeActionBtns.remove();
        const siblingBtns = document.getElementById('node-sibling-btns');
        if (siblingBtns) siblingBtns.remove();
    }

    saveNodeEdit() {
        if (!this.nodeBeingEdited) return;
        const originalData = this.nodeBeingEdited.data;
        const wasPlaceholder = this.isPlaceholderNodeData(originalData);
        const isRootPlaceholder = this.isRootPlaceholderNode(this.nodeBeingEdited);
        let newName = this.nodeEditInput.value.trim();
        
        if (originalData && originalData.color === '#e75480') {
            if (!/^Assumption:\s/.test(newName)) {
                newName = 'Assumption: ' + newName;
            }
        }
        
        if (this.isLeafNode(this.nodeBeingEdited) && this.isGreenNode(this.nodeBeingEdited)) {
            if (!newName.endsWith(' (Simplify?)')) {
                newName = newName + ' (Simplify?)';
            }
        } else {
            if (newName.endsWith(' (Simplify?)')) {
                newName = newName.substring(0, newName.length - ' (Simplify?)'.length);
            }
        }
        
        if (newName !== originalData.name || (isRootPlaceholder && originalData.color !== this.getPlaceholderColor())) {
            this.pushUndo();
            if (wasPlaceholder) {
                this.markNodeAsReal(originalData);
            }
            originalData.name = newName;
            if (isRootPlaceholder) {
                this.rootData = this.wrapRootWithPlaceholder(this.rootData);
            }
            this.ensureRightmostPlaceholderNodes(this.rootData);
            this.updateSimplifyPrefixes(d3.hierarchy(this.rootData));
            this.renderFlowchart(this.rootData);
            this.autosave();
        }
        this.hideContextMenu();
    }

    exportAsJSON() {
        function stripParents(node) {
            const { name, children, color } = node;
            const out = { name };
            if (color) out.color = color;
            if (children) out.children = children.map(stripParents);
            return out;
        }
        return JSON.stringify({
            tree: stripParents(this.rootData),
            customConnections: this.customConnections.map(conn => ({
                source: conn.source.name,
                target: conn.target.name,
                _offset: conn._offset || 0
            }))
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

    showExportPopup() {
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
            
            this.loadFlowchartList();
            
            let addedCount = 0;
            flowchartsToImport.forEach(item => {
                try {
                    JSON.parse(item.data);
                    this.flowchartList.push({
                        title: item.title || `Imported Flowchart ${this.flowchartList.length + 1}`,
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

    renderFlowchart(data) {
        this.syncTransform();
        this.rootData = this.wrapRootWithPlaceholder(data);
        
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

        const treeLayout = d3.tree()
            .nodeSize([150, 200]);

        const root = d3.hierarchy(this.rootData);
        treeLayout(root);

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
                    this.showNodeEditPopup(d);
                    this.selectNode(d);
                }
            })
            .on('contextmenu', (event, d) => {
                event.preventDefault();
                this.showNodeEditPopup(d);
                this.selectNode(d);
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
        .attr('stroke', d => this.isPlaceholderNodeData(d.data) || !(d.data.name || '').trim() ? this.getPlaceholderColor() : '#999')
        .attr('stroke-width', d => this.isPlaceholderNodeData(d.data) || !(d.data.name || '').trim() ? '0' : '1.5px');

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
            y: (i - (arr.length-1)/2) * LINE_HEIGHT + 4
        })))
        .enter()
        .append('tspan')
        .attr('x', 0)
        .attr('y', d => d.y)
        .text(d => d.line);

        const isIdentity = (t) => t.k === 1 && t.x === 0 && t.y === 0;
        if (isIdentity(this.transform)) {
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
