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


        // Node edit popup handlers
        this.nodeEditForm.addEventListener('submit', (e) => {
            e.preventDefault();
            // Do nothing on enter, let blur or background click handle save
        });

        // Initial flowchart render with sample data
        this.renderFlowchart(this.getSampleData());

        // Flag to track initial view setup
        this._hasInitialView = false;

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
        // Remove deleteNodeBtn event listener
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
        this.storageSlots.innerHTML = '';
        
        // Create 10 storage slots
        for (let i = 0; i < 10; i++) {
            const slot = document.createElement('div');
            slot.style.display = 'flex';
            slot.style.gap = '8px';
            slot.style.alignItems = 'center';
            
            const titleInput = document.createElement('input');
            titleInput.type = 'text';
            titleInput.placeholder = `Flowchart ${i+1}`;
            titleInput.style.flex = '1';
            titleInput.style.padding = '4px 8px';
            titleInput.style.border = '1px solid #aaa';
            titleInput.style.borderRadius = '4px';
            
            const selectBtn = document.createElement('button');
            selectBtn.textContent = 'Select';
            selectBtn.style.padding = '4px 12px';
            selectBtn.style.background = '#e0f0ff';
            selectBtn.style.border = '1px solid #aaa';
            selectBtn.style.borderRadius = '4px';
            selectBtn.style.cursor = 'pointer';
            
            const saveBtn = document.createElement('button');
            saveBtn.textContent = 'Save';
            saveBtn.style.padding = '4px 12px';
            saveBtn.style.background = '#e0ffe0';
            saveBtn.style.border = '1px solid #aaa';
            saveBtn.style.borderRadius = '4px';
            saveBtn.style.cursor = 'pointer';
            
            // Load saved data if exists
            const savedData = localStorage.getItem(`flowchart-slot-${i}`);
            if (savedData) {
                try {
                    const parsed = JSON.parse(savedData);
                    if (parsed.title) titleInput.value = parsed.title;
                } catch (e) {
                    console.error('Error parsing saved data:', e);
                }
            }
            // Confirm before selecting (loading) a saved slot
            selectBtn.onclick = (ev) => {
                ev.stopPropagation();
                const title = titleInput.value || `Flowchart ${i+1}`;
                if (!localStorage.getItem(`flowchart-slot-${i}`)) {
                    alert('No saved flowchart in this slot.');
                    return;
                }
                if (confirm(`Load "${title}" from slot ${i+1}? Unsaved changes will be lost.`)) {
                    this.loadFromStorage(i);
                    this.storagePopup.style.display = 'none';
                }
            };
            
            saveBtn.onclick = (ev) => {
                ev.stopPropagation();
                const title = titleInput.value || `Flowchart ${i+1}`;
                const hasExisting = !!localStorage.getItem(`flowchart-slot-${i}`);
                const msg = hasExisting ?
                    `Overwrite existing "${title}" in slot ${i+1}?` :
                    `Save "${title}" to slot ${i+1}?`;
                if (confirm(msg)) {
                    this.saveToStorage(i, titleInput.value);
                }
            };
            
            slot.appendChild(titleInput);
            slot.appendChild(selectBtn);
            slot.appendChild(saveBtn);
            this.storageSlots.appendChild(slot);
        }
        
        this.storagePopup.style.display = 'block';
    }
    
    saveToStorage(slotIndex, title) {
        const data = {
            title: title || `Flowchart ${slotIndex+1}`,
            data: this.exportAsJSON(),
            timestamp: new Date().toISOString()
        };
        
        localStorage.setItem(`flowchart-slot-${slotIndex}`, JSON.stringify(data));
        this.showStoragePopup(); // Refresh the list
        // Notify the user that the save completed
        try {
            this.showNotification(`Saved "${data.title}" to slot ${slotIndex+1}`);
        } catch (e) {
            // Fallback to alert if notifications fail
            console.log('Notification failed:', e);
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
            transition: 'opacity 300ms ease'
        });
        document.body.appendChild(notif);
        setTimeout(() => {
            notif.style.opacity = '0';
            setTimeout(() => {
                try { notif.remove(); } catch (e) {}
            }, 300);
        }, duration);
    }
    
    loadFromStorage(slotIndex) {
        const savedData = localStorage.getItem(`flowchart-slot-${slotIndex}`);
        if (!savedData) return;
        
        try {
            const parsed = JSON.parse(savedData);
            if (parsed.data) {
                const flowData = JSON.parse(parsed.data);
                if (flowData.tree) {
                    this.pushUndo();
                    this.renderFlowchart(flowData.tree);
                    
                    // Restore connections if they exist
                    if (flowData.customConnections) {
                        const nodeMap = new Map();
                        d3.hierarchy(this.rootData).each(d => nodeMap.set(d.data.name, d.data));
                        
                        this.customConnections = flowData.customConnections
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
                }
            }
        } catch (e) {
            console.error('Error loading saved flowchart:', e);
            alert('Failed to load saved flowchart');
        }
    }

    getSampleData() {
        // Sample hierarchical data
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
        const zoom = d3.zoom()
            .scaleExtent([this.minZoom, this.maxZoom])
            .on('zoom', (event) => {
                this.transform = event.transform;
                g.attr('transform', this.transform);
                // Hide context menu and node edit popup when zooming
                this.hideContextMenu();
                this.hideNodeEditPopup(true);
            });

        svg.call(zoom);

        // Prevent double-application of zoom transform
        if (this.transform) {
            svg.call(zoom.transform, this.transform);
        }

        // Remove default double-click behavior
        svg.on('dblclick.zoom', null);
        svg.on('dblclick', () => this.resetZoom());

        // Add panning with mouse drag
        let isDragging = false;
        let startX, startY;

        svg.on('mousedown', (event) => {
            // Only start drag if not clicking on a node or context menu
            if (event.button === 0 && !event.target.closest('.node') && !event.target.closest('.context-menu')) {
                isDragging = true;
                startX = event.clientX;
                startY = event.clientY;
                svg.style('cursor', 'grabbing');
                // Hide context menu if open when starting drag
                this.hideContextMenu();
                // Hide node edit popup if open when starting drag
                this.hideNodeEditPopup(true);
            }
        });

        svg.on('click', (event) => {
            // Hide context menu and node edit popup if clicking on background (not node or menu)
            if (event.target === svg.node()) {
                this.hideContextMenu();
                this.hideNodeEditPopup(true); // Save on background click
                // Only cancel move if in move mode
                if (this.isMovingNode) {
                    this.cancelMoveNode();
                }
                if (this.isMakingConnection) {
                    this.cancelMakeConnection();
                }
            }
        });

        svg.on('mousemove', (event) => {
            if (isDragging) {
                const dx = event.clientX - startX;
                const dy = event.clientY - startY;

                this.transform.x += dx;
                this.transform.y += dy;

                g.attr('transform', this.transform);

                startX = event.clientX;
                startY = event.clientY;
            }
        });

        svg.on('mouseup', () => {
            isDragging = false;
            svg.style('cursor', '');
        });

        svg.on('mouseleave', () => {
            isDragging = false;
            svg.style('cursor', '');
        });
    }

    zoom(factor) {
        const currentScale = this.transform.k;
        const newScale = currentScale * factor;

        if (newScale < this.minZoom || newScale > this.maxZoom) {
            return;
        }

        // Get center of viewport
        const container = this.flowchartContainer.getBoundingClientRect();
        const centerX = container.width / 2;
        const centerY = container.height / 2;

        // Calculate new transform
        this.transform = d3.zoomIdentity
            .translate(this.transform.x, this.transform.y)
            .scale(newScale)
            .translate(-centerX, -centerY)
            .translate(centerX, centerY);

        // Apply the transform
        d3.select('#flowchart g')
            .attr('transform', this.transform);
    }

    resetZoom() {
        const container = this.flowchartContainer.getBoundingClientRect();
        const centerX = container.width / 2;
        const centerY = container.height / 2;

        this.transform = d3.zoomIdentity
            .translate(this.transform.x, this.transform.y)
            .scale(1);

        d3.select('#flowchart g')
            .transition()
            .duration(300)
            .attr('transform', this.transform);
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

        // If the last child is already blank OR a placeholder, don't add another
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

    resetView() {
        this.transform = d3.zoomIdentity;
        this.currentZoom = null;
        this._hasInitialView = false;
        d3.select('#flowchart g')
            .transition()
            .duration(300)
            .attr('transform', this.transform);

        // Also update the flowchart in case the window was resized
        this.updateFlowchart();
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

        // Match the look used by the move button: fade the dragged subtree.
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

            // Clear previous hover highlight.
            d3.selectAll('.node')
                .selectAll('rect')
                .attr('stroke', d => d === sourceD ? '#ff9900' : '#999')
                .attr('stroke-width', d => d === sourceD ? '3px' : '1.5px');

            // Highlight hovered valid target.
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

    // Start move mode: highlight node and subtree, set flags
    startMoveNode(d) {
        this.isMovingNode = true;
        this.movingNodeDatum = d;
        this.movingNodeAncestors = new Set(d.ancestors().map(a => a.data));
        // Make node and descendants semi-transparent
        d3.selectAll('.node')
            .filter(nd => d.descendants().includes(nd))
            .selectAll('rect')
            .attr('opacity', 0.4);
        // Show instruction
        this.showMoveInstruction();
        // Listen for click on another node
        d3.selectAll('.node')
            .on('click.move', (event, targetD) => {
                // Prevent moving under itself or descendants
                if (d === targetD || d.descendants().includes(targetD)) {
                    this.cancelMoveNode();
                    return;
                }
                this.moveNodeTo(d, targetD);
                this.cancelMoveNode();
            });
        // Cancel move if click on background
        d3.select('svg').on('click.cancelmove', (event) => {
            if (event.target.tagName === 'svg') {
                this.cancelMoveNode();
            }
        });
    }

    showMoveInstruction() {
        // Show a simple overlay at the bottom with a cancel button
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
        // Restore opacity
        d3.selectAll('.node rect').attr('opacity', 1);
        // Remove move listeners
        d3.selectAll('.node').on('click.move', null);
        d3.select('svg').on('click.cancelmove', null);
        this.hideMoveInstruction();
    }

    // Start connection mode: highlight source node, set flags
    startMakeConnection(d) {
        this.isMakingConnection = true;
        this.connectionSourceNode = d;
        // Highlight source node
        d3.selectAll('.node')
            .filter(nd => nd === d)
            .selectAll('rect')
            .attr('stroke', '#ff9900')
            .attr('stroke-width', '2px');
        // Show instruction
        this.showConnectionInstruction();
        // Listen for click on target node
        d3.selectAll('.node')
            .on('click.connect', (event, targetD) => {
                // Prevent connecting to itself
                if (d === targetD) {
                    this.cancelMakeConnection();
                    return;
                }
                this.createConnection(d, targetD);
                this.hideNodeEditPopup(false); // <-- Hide text editor after connection
                this.cancelMakeConnection();
            });
        // Cancel connection if click on background
        d3.select('svg').on('click.cancelconnect', (event) => {
            if (event.target.tagName === 'svg') {
                this.cancelMakeConnection();
            }
        });
    }

    showConnectionInstruction() {
        // Show a simple overlay at the bottom with a cancel button
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
        // Reset source node highlight
        if (this.connectionSourceNode) {
            d3.selectAll('.node')
                .filter(nd => nd === this.connectionSourceNode)
                .selectAll('rect')
                .attr('stroke', '#999')
                .attr('stroke-width', '1.5px');
        }
        this.connectionSourceNode = null;
        // Remove connection listeners
        d3.selectAll('.node').on('click.connect', null);
        d3.select('svg').on('click.cancelconnect', null);
        this.hideConnectionInstruction();
    }

    createConnection(sourceD, targetD) {
        this.pushUndo();

        // Determine which node is higher in hierarchy
        const sourceLevel = this.getNodeLevel(sourceD);
        const targetLevel = this.getNodeLevel(targetD);

        // Store connection with proper source/target order
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

        // Re-render
        this.renderFlowchart(this.rootData);
    }

    // Deep clone utility for data snapshots
    cloneData(data) {
        return JSON.parse(JSON.stringify(data));
    }

    // Push current state to undo stack
    pushUndo() {
        const state = {
            data: this.cloneData(this.rootData),
            connections: JSON.parse(JSON.stringify(this.customConnections))
        };
        this.undoStack.push(state);
        // Limit stack size if desired
        if (this.undoStack.length > 100) this.undoStack.shift();
        // Clear redo stack on new action
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
    }

    moveNodeTo(movingD, newParentD) {
        if (movingD === newParentD || movingD.descendants().includes(newParentD)) {
            return;
        }

        this.pushUndo();
        
        // Get the moving data and its parent
        const movingData = movingD.data;
        const parent = movingD.parent;
        
        // First, remove the moving node from its parent
        if (parent) {
            // Remove the node from parent's children
            parent.data.children = (parent.data.children || []).filter(child => child !== movingData);
            if (parent.data.children.length === 0) {
                delete parent.data.children;
            } else {
                // Clean up any placeholder nodes in the parent
                const children = parent.data.children;
                // Remove any placeholder nodes that are not at the end
                for (let i = children.length - 2; i >= 0; i--) {
                    if (this.isPlaceholderNodeData(children[i])) {
                        children.splice(i, 1);
                    }
                }
                // Ensure the last child is a placeholder if there are children
                const lastChild = children[children.length - 1];
                if (!this.isPlaceholderNodeData(lastChild) && lastChild.name && lastChild.name.trim()) {
                    // Add a placeholder at the end
                    children.push(this.createPlaceholderNode());
                }
            }
        }
        
        // Now add the moving node to the new parent
        if (!newParentD.data.children) {
            newParentD.data.children = [];
        }
        
        // Remove any placeholder at the end of the new parent's children
        const newChildren = newParentD.data.children;
        if (newChildren.length > 0) {
            const lastChild = newChildren[newChildren.length - 1];
            if (this.isPlaceholderNodeData(lastChild)) {
                newChildren.pop();
            }
        }
        
        // Add the moving node
        newParentD.data.children.push(movingData);
        
        // Add a placeholder at the end
        newParentD.data.children.push(this.createPlaceholderNode());
        
        // Ensure all placeholders are correct throughout the tree
        this.ensureRightmostPlaceholderNodes(this.rootData);
        
        // Update all simplify suffixes after moving
        this.updateSimplifyPrefixes(d3.hierarchy(this.rootData));
        
        // Re-render
        this.renderFlowchart(this.rootData);
        this.updateUndoRedoButtons();
        this.hideNodeEditPopup(false);
    }

    addChildNode(d) {
        // Save for undo
        this.pushUndo();
        // Ensure children array exists
        if (!d.data.children) d.data.children = [];
        // Generate a unique name for the new child
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
        return newChild; // Return the new child object for further processing
    }

    // Add a new parent above the given node. New parent replaces the node in its previous
    // position and the original node becomes a child of the new parent. New parent starts
    // with an empty name and is opened for immediate editing.
    addParentNode(d) {
        this.pushUndo();
        const oldData = d.data;
        const parent = d.parent;
        const newParent = { name: '' };
        // Make the old node a child of the new parent
        newParent.children = [oldData];

        if (parent) {
            // Replace the old node in parent's children with the new parent
            const siblings = parent.data.children || [];
            const idx = siblings.indexOf(oldData);
            if (idx !== -1) {
                siblings[idx] = newParent;
            } else {
                // Fallback: append if not found
                siblings.push(newParent);
            }
            parent.data.children = siblings;
        } else {
            // Old node was root; newParent becomes the new root
            this.rootData = newParent;
        }

        // Re-render and open the new parent's editor
        this.renderFlowchart(this.rootData);
        // Find the d3 node corresponding to newParent
        let found = null;
        d3.hierarchy(this.rootData).each(node => {
            if (node.data === newParent) found = node;
        });
        if (found) {
            // Open editor and focus/select for typing
            this.showNodeEditPopup(found);
            // Ensure input is empty and focused
            this.nodeEditInput.value = '';
            this.nodeEditInput.focus();
            this.nodeEditInput.select();
        }
        this.updateUndoRedoButtons();
    }

    // Duplicate the given node (excluding its children) as a child of each of its parent's siblings
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

        // Create a shallow copy of node data excluding children
        const nodeCopy = {};
        for (const key in d.data) {
            if (key === 'children') continue;
            // copy primitive values (name, color, etc.)
            nodeCopy[key] = JSON.parse(JSON.stringify(d.data[key]));
        }

        // For each sibling of the parent (i.e., other children of grandparent), add the copy as a child
        const siblings = (grandparent.data.children || []).filter(child => child !== parent.data);
        siblings.forEach(sibData => {
            if (!sibData.children) sibData.children = [];
            // Insert a fresh copy for each sibling
            const newNode = JSON.parse(JSON.stringify(nodeCopy));
            // Ensure a unique name if name collision occurs among siblings' children
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
    }

    addSiblingNode(d, direction) {
        // direction: -1 => left (before), 1 => right (after)
        if (!d.parent) {
            alert('Cannot add a sibling to the root node.');
            return null;
        }
        this.pushUndo();
        const parent = d.parent;
        if (!parent.data.children) parent.data.children = [];
        const siblings = parent.data.children;
        // Generate unique sibling name
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
        // Open editor for the newly created sibling
        let found = null;
        d3.hierarchy(this.rootData).each(node => {
            if (node.data === newSibling) found = node;
        });
        if (found) this.showNodeEditPopup(found);
        this.updateUndoRedoButtons();
        return newSibling;
    }

    deleteNode(d) {
        // Prevent deleting root
        if (!d.parent) {
            alert("Cannot delete the root node.");
            return;
        }
        this.pushUndo();
        // Remove from parent's children
        const parent = d.parent;
        parent.data.children = (parent.data.children || []).filter(child => child !== d.data);
        if (parent.data.children.length === 0) delete parent.data.children;
        // Remove any connections involving this node
        this.customConnections = this.customConnections.filter(conn =>
            conn.source !== d.data && conn.target !== d.data
        );
        this.renderFlowchart(this.rootData);
        this.updateUndoRedoButtons();
    }

    showNodeEditPopup(d) {
        this.nodeBeingEdited = d;
        
        // Check if leaf node and green - append "(Simplify?)" if needed
        let displayName = d.data.name;
        if (this.isLeafNode(d) && this.isGreenNode(d)) {
            if (!displayName.endsWith(' (Simplify?)')) {
                displayName = displayName + ' (Simplify?)';
            }
        } else {
            // Remove "(Simplify?)" if it exists and node is no longer a leaf/green
            if (displayName.endsWith(' (Simplify?)')) {
                displayName = displayName.substring(0, displayName.length - ' (Simplify?)'.length);
            }
        }
        
        this.nodeEditInput.value = displayName;
        // Focus and select all text for quick editing
        this.nodeEditInput.focus();
        this.nodeEditInput.select();
        // Ensure selection occurs after popup is inserted/focused in all browsers
        setTimeout(() => {
            try { this.nodeEditInput.select(); } catch (e) { /* ignore */ }
        }, 0);
        // Add node action buttons above color buttons if not already present
        let nodeActionBtns = document.getElementById('node-action-btns');
        if (!nodeActionBtns) {
            nodeActionBtns = document.createElement('div');
            nodeActionBtns.id = 'node-action-btns';
            nodeActionBtns.style.display = 'flex';
            nodeActionBtns.style.gap = '10px';
            nodeActionBtns.style.marginBottom = '10px';
            nodeActionBtns.style.justifyContent = 'center';
            // Add Child
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
                            // Clear and focus input for new child
                            this.nodeEditInput.value = '';
                            this.nodeEditInput.focus();
                        }
                    }
                }
            };
            // Note: Move controls are placed in a separate row below
            // Add Parent
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
            // Make Connection
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
            // Duplicate Node to parent's siblings
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
            // Delete Node
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
            // Delete Node but promote its children up into the parent at the same position
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
                // Implement promote-children deletion
                if (!d.parent) {
                    alert('Cannot delete the root node.');
                    return;
                }
                this.pushUndo();
                const parent = d.parent;
                const siblings = parent.data.children || [];
                const idx = siblings.indexOf(d.data);
                const children = d.data.children || [];
                // Remove the node and insert its children at the same index
                if (idx !== -1) {
                    // Remove the node
                    siblings.splice(idx, 1);
                    if (children.length > 0) {
                        // Insert children in place
                        siblings.splice(idx, 0, ...children);
                    }
                }
                // Clean up: if parent has no children, remove the children property
                if (parent.data.children && parent.data.children.length === 0) delete parent.data.children;
                // Remove any custom connections involving the deleted node
                this.customConnections = this.customConnections.filter(conn => conn.source !== d.data && conn.target !== d.data);
                this.renderFlowchart(this.rootData);
                this.updateUndoRedoButtons();
            };
            nodeActionBtns.appendChild(addChildBtn);
            nodeActionBtns.appendChild(addParentBtn);
            nodeActionBtns.appendChild(makeConnBtn);
            nodeActionBtns.appendChild(duplicateBtn);
            nodeActionBtns.appendChild(deleteNodeBtn);
            nodeActionBtns.appendChild(deletePromoteBtn);
            this.nodeEditPopup.insertBefore(nodeActionBtns, this.nodeEditPopup.firstChild);

            // Create a second row for sibling controls (Add Sibling Left, Add Sibling Right)
            const nodeSiblingBtns = document.createElement('div');
            nodeSiblingBtns.id = 'node-sibling-btns';
            nodeSiblingBtns.style.display = 'flex';
            nodeSiblingBtns.style.gap = '10px';
            nodeSiblingBtns.style.margin = '8px 0 6px 0';
            nodeSiblingBtns.style.justifyContent = 'center';

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

            // Create a third row for move controls (Move, Move Left, Move Right)
            const nodeMoveBtns = document.createElement('div');
            nodeMoveBtns.id = 'node-move-btns';
            nodeMoveBtns.style.display = 'flex';
            nodeMoveBtns.style.gap = '10px';
            nodeMoveBtns.style.margin = '8px 0 12px 0';
            nodeMoveBtns.style.justifyContent = 'center';

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
                // Move within siblings to the left
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
                // Move within siblings to the right
                this.moveNodeInSiblings(d, 1);
            };

            nodeMoveBtns.appendChild(moveBtn);
            nodeMoveBtns.appendChild(moveLeftBtn);
            nodeMoveBtns.appendChild(moveRightBtn);
            this.nodeEditPopup.insertBefore(nodeMoveBtns, this.nodeEditPopup.firstChild);
        }
        // Add color buttons above the input if not already present
        let colorBtns = document.getElementById('node-color-btns');
        if (!colorBtns) {
            colorBtns = document.createElement('div');
            colorBtns.id = 'node-color-btns';
            colorBtns.style.display = 'flex';
            colorBtns.style.gap = '10px';
            colorBtns.style.marginBottom = '10px';
            colorBtns.style.justifyContent = 'center';
            // Green button
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
                    // Update all simplify suffixes after color change
                    this.updateSimplifyPrefixes(d3.hierarchy(this.rootData));
                    this.renderFlowchart(this.rootData);
                    this.showNodeEditPopup(this.nodeBeingEdited); // re-show popup to keep editing
                }
            };
            // Pink button
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
                    // Prefix name with Assumption: if not already present
                    if (!/^Assumption:\s/.test(this.nodeBeingEdited.data.name)) {
                        this.nodeBeingEdited.data.name = 'Assumption: ' + (this.nodeBeingEdited.data.name || '');
                    }
                    this.ensureRightmostPlaceholderNodes(this.rootData);
                    // Update all simplify suffixes after color change
                    this.updateSimplifyPrefixes(d3.hierarchy(this.rootData));
                    this.renderFlowchart(this.rootData);
                    this.showNodeEditPopup(this.nodeBeingEdited);
                    // Update input value and select for quick typing
                    this.nodeEditInput.value = this.nodeBeingEdited.data.name;
                    setTimeout(() => { try { this.nodeEditInput.select(); } catch (e) {} }, 0);
                }
            };
            // Blue button
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
                    // Update all simplify suffixes after color change
                    this.updateSimplifyPrefixes(d3.hierarchy(this.rootData));
                    this.renderFlowchart(this.rootData);
                    this.showNodeEditPopup(this.nodeBeingEdited);
                }
            };
            // Yellow button
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
                    // Update all simplify suffixes after color change
                    this.updateSimplifyPrefixes(d3.hierarchy(this.rootData));
                    this.renderFlowchart(this.rootData);
                    this.showNodeEditPopup(this.nodeBeingEdited);
                }
            };
            // Empty button
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
                    // Update all simplify suffixes after color change
                    this.updateSimplifyPrefixes(d3.hierarchy(this.rootData));
                    this.renderFlowchart(this.rootData);
                    this.showNodeEditPopup(this.nodeBeingEdited);
                }
            };
            colorBtns.appendChild(greenBtn);
            colorBtns.appendChild(pinkBtn);
            colorBtns.appendChild(blueBtn);
            colorBtns.appendChild(yellowBtn);
            colorBtns.appendChild(emptyBtn);
            this.nodeEditPopup.insertBefore(colorBtns, this.nodeEditPopup.firstChild);
        }
        // Highlight selected color
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
        // Only move if node has a parent
        if (!d.parent) return;
        const siblings = d.parent.data.children;
        const idx = siblings.indexOf(d.data);
        if (idx === -1) return;
        const newIdx = idx + direction;
        if (newIdx < 0 || newIdx >= siblings.length) return;
        this.pushUndo();
        // Swap positions
        [siblings[idx], siblings[newIdx]] = [siblings[newIdx], siblings[idx]];
        this.renderFlowchart(this.rootData);
        // Keep popup open on the same node
        // Find the new d3.hierarchy node for the same data
        let found = null;
        d3.hierarchy(this.rootData).each(node => {
            if (node.data === d.data) found = node;
        });
        if (found) this.showNodeEditPopup(found);
    }

    hideNodeEditPopup(save = true) {
        if (save) this.saveNodeEdit();
        this.nodeEditPopup.style.display = 'none';
        this.nodeBeingEdited = null;
        // Remove color, move, and action buttons
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
        
        // If node is pink, ensure prefix is present
        if (originalData && originalData.color === '#e75480') {
            if (!/^Assumption:\s/.test(newName)) {
                newName = 'Assumption: ' + newName;
            }
        }
        
        // If node is leaf and green, ensure "(Simplify?)" suffix is present
        if (this.isLeafNode(this.nodeBeingEdited) && this.isGreenNode(this.nodeBeingEdited)) {
            if (!newName.endsWith(' (Simplify?)')) {
                newName = newName + ' (Simplify?)';
            }
        } else {
            // Remove "(Simplify?)" if it exists and node is no longer a leaf/green
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
            // Update all simplify suffixes after name change
            this.updateSimplifyPrefixes(d3.hierarchy(this.rootData));
            this.renderFlowchart(this.rootData);
        }
        // Don't call hideNodeEditPopup here to avoid recursion
        this.hideContextMenu(); // Hide context menu when saving edit
    }

    // Export the current flowchart as JSON (tree + custom connections)
    exportAsJSON() {
        // Remove circular references for export
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

    // Export the current flowchart as indented text (legacy)
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
        // Show JSON export by default
        this.exportTextarea.value = this.exportAsJSON();
        this.exportPopup.style.display = 'block';
        this.exportTextarea.select();
    }

    // Import flowchart from JSON or indented text
    importFromText() {
        const text = this.importTextarea.value;
        if (!text.trim()) {
            alert("Paste exported JSON or indented text to import.");
            return;
        }
        try {
            let data, customConnections = [];
            // Try JSON first
            try {
                const parsed = JSON.parse(text);
                if (parsed && parsed.tree) {
                    data = parsed.tree;
                    customConnections = parsed.customConnections || [];
                } else {
                    throw new Error("Not a valid flowchart JSON.");
                }
            } catch (jsonErr) {
                // Fallback to indented text
                data = this.parseIndentedText(text);
                customConnections = [];
            }
            this.pushUndo();
            // Rebuild customConnections with references to node objects
            this.renderFlowchart(data);
            if (customConnections.length > 0) {
                // Map node names to node objects
                const nodeMap = new Map();
                d3.hierarchy(this.rootData).each(d => nodeMap.set(d.data.name, d.data));
                this.customConnections = customConnections
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
                // Re-render to show connections
                this.renderFlowchart(this.rootData);
            } else {
                this.customConnections = [];
            }
            this.importPopup.style.display = 'none';
        } catch (e) {
            alert("Failed to import. Make sure the format is correct.");
        }
    }

    showImportPopup() {
        this.importTextarea.value = '';
        this.importPopup.style.display = 'block';
        this.importTextarea.focus();
    }

    // Parse indented text into tree structure
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

    // Store per-connection offset for custom connections
    getConnectionOffset(conn) {
        if (!conn._offset) conn._offset = 0;
        return conn._offset;
    }
    setConnectionOffset(conn, offset) {
        conn._offset = offset;
    }

    // Move selected connection by dx
    moveSelectedConnection(dx) {
        if (!this.selectedConnection) return;
        this.pushUndo();
        this.setConnectionOffset(this.selectedConnection, this.getConnectionOffset(this.selectedConnection) + dx);
        this.renderFlowchart(this.rootData);
        // Keep the connection selected after re-render
        setTimeout(() => this.selectConnectionByData(this.selectedConnection), 0);
    }

    // Select a connection (by data object)
    selectConnectionByData(conn) {
        this.selectedConnection = conn;
        // Show controls
        this.connectionControlsRow.style.display = 'flex';
        this.connectionControls.style.display = 'flex';
        // Highlight the selected connection
        d3.selectAll('.custom-link').classed('selected', d => d === conn);
    }

    // Deselect connection
    deselectConnection() {
        this.selectedConnection = null;
        this.connectionControlsRow.style.display = 'none';
        this.connectionControls.style.display = 'none';
        d3.selectAll('.custom-link').classed('selected', false);
    }

    // Node selection logic (sibling control row removed)
    selectNode(d) {
        this.selectedNode = d;
        // The sibling add buttons row has been removed per design.
        // Ensure the node controls row remains hidden and empty.
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
        // Remove the selected connection from customConnections
        this.customConnections = this.customConnections.filter(conn => conn !== this.selectedConnection);
        this.deselectConnection();
        this.renderFlowchart(this.rootData);
    }

    renderFlowchart(data) {
        // Save root data for move operations
        this.rootData = this.wrapRootWithPlaceholder(data);
        const contentRoot = this.rootData.children && this.rootData.children.length > 0
            ? this.rootData.children[0]
            : this.rootData;
        this.ensureRightmostPlaceholderNodes(contentRoot);
        
        // Update all simplify suffixes before rendering
        const rootHierarchy = d3.hierarchy(this.rootData);
        this.updateSimplifyPrefixes(rootHierarchy);
        
        // Clear previous flowchart
        this.flowchartContainer.innerHTML = '';

        // Set up SVG dimensions
        const width = this.flowchartPanel.clientWidth;
        const height = this.flowchartPanel.clientHeight;

        // Create SVG
        const svg = d3.select('#flowchart')
            .append('svg')
            .attr('width', width)
            .attr('height', height)
            .attr('viewBox', `0 0 ${width} ${height}`);

        // Create root group
        const g = svg.append('g');

        // Set up zoom behavior
        this.setupZoom(svg, g);

        // Create tree layout
        const treeLayout = d3.tree()
            .nodeSize([150, 200]);

        // Create hierarchy from the wrapped root so placeholder nodes are rendered immediately
        const root = d3.hierarchy(this.rootData);
        treeLayout(root);

        // Draw links with filleted corners (vertical/horizontal lines)
        const cornerRadius = 10;
        g.append('g')
            .selectAll('path')
            .data(root.links())
            .enter()
            .append('path')
            .attr('class', 'link')
            .attr('d', d => {
                // Snap x/y to nearest 10 for vertical/horizontal segments
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

        // Draw custom connections
        if (this.customConnections.length > 0) {
            const nodeMap = new Map();
            root.each(d => {
                nodeMap.set(d.data, d);
            });

            this.customConnections = this.customConnections.filter(conn => {
                return nodeMap.has(conn.source) && nodeMap.has(conn.target);
            });

            const customLinksGroup = g.append('g');

            // Default vertical entry distance for connectors (matches tree layout)
            const verticalEntry = 80;
            const fillet = 10; // radius for corner fillets (match cornerRadius)

            // Helper for fillet path
            function filletPath(sx, sy, ex, ey, r, horizontalFirst = true) {
                // Only supports 90-degree corners
                if (horizontalFirst) {
                    return `L ${ex - Math.sign(ex - sx) * r},${sy}
                        Q ${ex},${sy} ${ex},${sy + Math.sign(ey - sy) * r}
                        L ${ex},${ey}`;
                } else {
                    return `L ${sx},${ey - Math.sign(ey - sy) * r}
                        Q ${sx},${ey} ${sx + Math.sign(ex - sx) * r},${ey}
                        L ${ex},${ey}`;
                }
            }

            // Draw wide invisible hit areas for easier selection
            customLinksGroup
                .selectAll('.custom-link-hit')
                .data(this.customConnections)
                .enter()
                .append('path')
                .attr('class', 'custom-link-hit')
                .attr('d', d => {
                    // Snap x/y to nearest 10 for vertical/horizontal segments
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

            // Draw actual visible connection lines above hit areas
            customLinksGroup
                .selectAll('.custom-link')
                .data(this.customConnections)
                .enter()
                .append('path')
                .attr('class', 'custom-link link')
                .classed('selected', d => d === this.selectedConnection)
                .attr('d', d => {
                    // Snap x/y to nearest 10 for vertical/horizontal segments
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

            // Deselect connection on background click
            d3.select('svg').on('click.deselectconn', (event) => {
                if (event.target.tagName === 'svg') {
                    this.deselectConnection();
                }
            });
        } else {
            // Remove deselect handler if no custom connections
            d3.select('svg').on('click.deselectconn', null);
            this.deselectConnection();
        }

        // Draw nodes
        const node = g.append('g')
            .selectAll('.node')
            .data(root.descendants())
            .enter()
            .append('g')
            .attr('class', 'node')
            // Snap node x to nearest 10
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
                // Only show node edit popup on left click
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

        // Add rectangles and wrapped text to nodes
        const NODE_WIDTH = 120;
        const LINE_HEIGHT = 18;
        const PADDING_Y = 12;
        const FONT_SIZE = 13;
        const FONT_FAMILY = 'Arial, sans-serif';

        // Helper to measure text width in SVG
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
            const words = d.data.name.split(/(\s+)/); // keep spaces
            let lines = [];
            let current = '';
            words.forEach(word => {
                const testLine = (current + word).trim();
                if (testLine && measureTextWidth(testLine) > NODE_WIDTH - 16) // 16px padding
                {
                    if (current) lines.push(current.trim());
                    current = word.trim();
                } else {
                    current += word;
                }
            });
            if (current.trim()) lines.push(current.trim());
            d._lines = lines.length ? lines : [d.data.name || ''];
        });

        // In the renderFlowchart method, modify the node.append('rect') section:
        node.append('rect')
        .attr('width', NODE_WIDTH)
        .attr('height', d => d._lines.length * LINE_HEIGHT + PADDING_Y)
        .attr('x', -NODE_WIDTH/2)
        .attr('y', d => -((d._lines.length * LINE_HEIGHT + PADDING_Y)/2))
        .attr('fill', d => {
            if (this.isPlaceholderNodeData(d.data) || !(d.data.name || '').trim()) {
                return this.getPlaceholderColor();
            }
            // Create a map of all nodes that are sources of custom connections
            const sourceNodes = new Set(this.customConnections.map(conn => conn.source));
            // Determine if node is a parent (has children or outgoing connections)
            const hasHierarchicalChildren = d.children && d.children.length > 0;
            const hasCustomConnections = sourceNodes.has(d.data);
            const isParentNode = hasHierarchicalChildren || hasCustomConnections;
            // For parent nodes
            if (isParentNode) {
                return d.data.color || '#00a67e'; // Green by default
            }
            // For leaf nodes, just use explicit color or default green
            return d.data.color || '#00a67e';
        })
        .attr('stroke', d => this.isPlaceholderNodeData(d.data) || !(d.data.name || '').trim() ? this.getPlaceholderColor() : '#999')
        .attr('stroke-width', d => this.isPlaceholderNodeData(d.data) || !(d.data.name || '').trim() ? '0' : '1.5px');
        // Then create the text elements with dynamic color
        node.append('text')
        .attr('text-anchor', 'middle')
        .attr('font-size', FONT_SIZE)
        .attr('font-weight', 'bold')
        .attr('fill', d => {
            if (this.isPlaceholderNodeData(d.data) || !(d.data.name || '').trim()) {
                return this.getPlaceholderColor();
            }
            const fill = d.data.color || '#00a67e';
            // Convert hex color to RGB
            function hexToRgb(hex) {
                if (!hex) return { r: 0, g: 0, b: 0 };
                if (hex[0] === '#') hex = hex.slice(1);
                if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
                const int = parseInt(hex, 16);
                return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
            }
            const { r, g, b } = hexToRgb(fill);
            // Perceived brightness formula
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

        // Only center the view on initial load or reset, not after every render
        if (!this._hasInitialView) {
            const bounds = g.node().getBBox();
            const scale = 0.9 / Math.max(bounds.width / width, bounds.height / height);
            const tx = (width - bounds.width * scale) / 2 - bounds.x * scale;
            const ty = (height - bounds.height * scale) / 2 - bounds.y * scale;
            g.attr('transform', `translate(${tx},${ty}) scale(${scale})`);
            this.transform = d3.zoomIdentity.translate(tx, ty).scale(scale);
            this._hasInitialView = true;
        } else {
            // Maintain previous transform (no auto-centering)
            g.attr('transform', this.transform);
        }

        this.updateUndoRedoButtons();
    }
}

// Initialize the viewer when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new FlowchartViewer();
});