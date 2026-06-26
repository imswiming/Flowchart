html,
body {
    height: 100%;
    margin: 0;
    padding: 0;
}

/* Dark theme variables (nodes keep their colors set in script.js) */
:root {
    --bg: #323a4a;
    --panel-bg: #0f1724;
    --surface: #0f1724;
    --text: #e6eef8;
    --muted: #9aa6b2;
    --border: #26313a;
    --control-bg: #111827;
    --control-hover: #1b2832;
    --popup-bg: #0f1724;
    --accent: #00a67e;
}

body {
    font-family: Arial, sans-serif;
    margin: 0;
    padding: 0;
    height: 100vh;
    width: 100vw;
    overflow: hidden;
    background: var(--bg);
    color: var(--text);
}

.container {
    height: 100vh;
    width: 100vw;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    position: relative;
}

.flowchart-panel {
    flex: 1 1 0;
    display: flex;
    flex-direction: column;
    padding: 0;
    overflow: hidden;
    position: relative;
    min-width: 200px;
    height: 100%;
    width: 100%;
}

.link.selected,
.custom-link.selected {
    stroke-width: 4px;
    stroke: #ff9900;
}

.connection-controls {
    position: absolute;
    bottom: 20px;
    left: 0;
    right: 0;
    display: flex;
    justify-content: space-between;
    padding: 0 20px;
    z-index: 100;
    pointer-events: none;
}

.connection-controls button {
    pointer-events: all;
    padding: 8px 16px;
    background: var(--control-bg) !important;
    border: 1px solid var(--border) !important;
    color: var(--text) !important;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
}

.connection-controls button:hover {
    background: var(--control-hover) !important;
}

#flowchart {
    flex: 1 1 0;
    border: none;
    overflow: hidden;
    height: 100%;
    width: 100%;
}

.node {
    cursor: pointer;
}

.node rect {
    stroke: #999;
    stroke-width: 1.5px;
    rx: 5;
    ry: 5;
}

.link {
    fill: none;
    stroke: #999;
    stroke-width: 1.5px;
}
.node text {
    font-size: 12px;
    font-weight: bold;
}

.zoom-controls {
    position: absolute;
    top: 20px;
    right: 20px;
    z-index: 100;
    display: flex;
    flex-direction: column;
    gap: 5px;
}

.zoom-btn {
    width: 30px;
    height: 30px;
    background: var(--control-bg) !important;
    border: 1px solid var(--border) !important;
    border-radius: 3px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    font-size: 16px;
    user-select: none;
}

.zoom-btn:hover {
    background: var(--control-hover) !important;
}

.reset-view-btn {
    width: 90px;
    height: 32px;
    background: var(--control-bg) !important;
    border: 1px solid var(--border) !important;
    border-radius: 3px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    font-size: 14px;
    user-select: none;
    margin-top: 10px;
}

.reset-view-btn:hover {
    background: var(--control-hover) !important;
}

.context-menu {
    position: absolute;
    background: var(--popup-bg) !important;
    border: 1px solid var(--border) !important;
    border-radius: 4px;
    box-shadow: 2px 2px 5px rgba(0, 0, 0, 0.2);
    padding: 5px 0;
    z-index: 1000;
    pointer-events: all;
}

.context-menu-item {
    padding: 8px 15px;
    cursor: pointer;
    white-space: nowrap;
}

.context-menu-item:hover {
    background-color: var(--control-hover) !important;
}

/* Override inline-styled popups and panels to dark surfaces */
#node-edit-popup,
#export-popup,
#import-popup,
#storage-popup,
#move-instruction,
#connection-instruction {
    background: var(--popup-bg) !important;
    color: var(--text) !important;
    border: 1px solid var(--border) !important;
    box-shadow: 0 6px 18px rgba(0,0,0,0.6) !important;
}

/* Buttons inside popups (exclude node color buttons so their inline colors show) */
#export-popup button,
#import-popup button,
#storage-popup button {
    background: var(--control-bg) !important;
    color: var(--text) !important;
    border: 1px solid var(--border) !important;
}

/* Node edit popup action/move/sibling buttons: restore original light theme */
#node-edit-popup #node-action-btns button,
#node-edit-popup #node-sibling-btns button,
#node-edit-popup #node-move-btns button {
    background: #f0f0f0;
    color: #333;
    border: 1px solid #aaa;
}

/* Export/Import popup button containers */
#export-popup div:last-child,
#import-popup div:last-child {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    justify-content: flex-end;
}

#export-popup button,
#import-popup button {
    white-space: nowrap;
    flex-shrink: 0;
}

.link-handle {
    fill: #999;
    cursor: ew-resize;
    opacity: 0;
    transition: opacity 0.2s;
}

.link:hover+.link-handle,
.link-handle:hover {
    opacity: 1;
}

.reset-view-controls {
    position: absolute;
    right: 20px;
    bottom: 20px;
    z-index: 101;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
}

#connection-controls {
    display: flex;
    align-items: center;
    gap: 4px;
    pointer-events: all;
}

#connection-controls button {
    pointer-events: all;
    margin-top: 0;
}

#connection-controls-row {
    display: flex;
    width: 100%;
    justify-content: flex-start;
    pointer-events: none;
}

#node-controls-row {
    display: none;
}

#delete-node-btn {
    display: none;
}

/* Storage popup styles */
#storage-popup {
    display: none;
    position: absolute;
    left: 50%;
    top: 80px;
    transform: translateX(-50%);
    background: var(--popup-bg) !important;
    border: 1px solid var(--border) !important;
    border-radius: 8px;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.6);
    padding: 16px 24px;
    z-index: 3000;
    font-size: 16px;
    min-width: 340px;
    max-height: 70vh;
    overflow: hidden;
}

#storage-slots {
    display: flex;
    flex-direction: column;
    gap: 8px;
    overflow-y: auto;
    max-height: 50vh;
}

.storage-slot {
    display: flex;
    gap: 8px;
    align-items: center;
    padding: 6px 8px;
    border-radius: 4px;
}

.storage-slot input {
    flex: 1;
    padding: 4px 8px;
    border: 1px solid var(--border) !important;
    background: var(--control-bg) !important;
    color: var(--text) !important;
    border-radius: 4px;
}

.storage-slot button {
    padding: 4px 12px;
    border: 1px solid var(--border) !important;
    border-radius: 4px;
    cursor: pointer;
    background: var(--control-bg) !important;
    color: var(--text) !important;
}

.copy-btn {
    background: #e0f0ff;
}

.active-slot {
    background-color: var(--control-hover) !important;
    border-left: 4px solid var(--accent) !important;
    padding-left: 8px;
}

/* Notification styles */
.flowchart-notification {
    position: fixed;
    right: 20px;
    bottom: 20px;
    background: rgba(0,0,0,0.85);
    color: #fff;
    padding: 10px 14px;
    border-radius: 6px;
    z-index: 9999;
    box-shadow: 0 6px 18px rgba(0,0,0,0.3);
    opacity: 1;
    transition: opacity 300ms ease;
    max-width: 400px;
}

/* Responsive styles for mobile */
@media (max-width: 600px) {

    html,
    body,
    .container,
    .flowchart-panel {
        position: fixed !important;
        inset: 0 !important;
        height: 100vh !important;
        min-height: 100vh !important;
        width: 100vw !important;
        min-width: 0 !important;
        overflow: auto !important;
        background: var(--bg) !important;
    }

    #flowchart {
        position: fixed !important;
        inset: 0 !important;
        height: 100vh !important;
        min-height: 400px !important;
        width: 100vw !important;
        min-width: 0 !important;
        display: block !important;
        background: var(--panel-bg) !important;
        overflow: auto !important;
    }

    .reset-view-controls {
        position: static;
        width: 100vw;
        align-items: stretch;
        margin: 0;
        right: 0;
        bottom: 0;
    }

    .reset-view-controls>div {
        flex-direction: column !important;
        gap: 6px !important;
        width: 100%;
    }

    #connection-controls-row,
    #node-controls-row {
        width: 100% !important;
        justify-content: stretch !important;
    }

    #connection-controls {
        flex-direction: column !important;
        gap: 6px !important;
        width: 100%;
    }

    .reset-view-btn,
    #connection-controls button {
        width: 100% !important;
        min-width: 0 !important;
        font-size: 15px !important;
        margin-top: 0 !important;
        box-sizing: border-box;
    }

    .zoom-controls {
        top: 10px;
        right: 10px;
        flex-direction: row;
        gap: 6px;
    }

    .zoom-btn {
        width: 36px;
        height: 36px;
        font-size: 18px;
    }

    #export-popup,
    #import-popup {
        min-width: 95vw !important;
        left: 50% !important;
        transform: translateX(-50%) !important;
        padding: 10px 4vw !important;
    }

    #export-textarea,
    #import-textarea {
        font-size: 13px !important;
        width: 100% !important;
        min-width: 0 !important;
    }

    #node-edit-popup {
        min-width: 90vw !important;
        max-width: 95vw !important;
        width: 95vw !important;
        left: 50% !important;
        transform: translateX(-50%) !important;
        padding: 10px 8px !important;
    }

    #node-edit-input {
        font-size: 15px !important;
    }

    #storage-popup {
        min-width: 95vw !important;
        left: 50% !important;
        transform: translateX(-50%) !important;
        padding: 12px 4vw !important;
        max-height: 80vh !important;
    }

    #storage-slots {
        max-height: 50vh !important;
    }

    .storage-slot {
        flex-wrap: wrap !important;
        gap: 4px !important;
    }

    .storage-slot button {
        font-size: 12px !important;
        padding: 4px 8px !important;
    }

    /* Fix button wrapping in node edit popup */
    #node-action-btns {
        display: flex !important;
        flex-wrap: wrap !important;
        gap: 6px !important;
        justify-content: center !important;
    }
    
    #node-action-btns button {
        flex: 0 1 auto !important;
        min-width: 0 !important;
        font-size: 13px !important;
        padding: 6px 12px !important;
        white-space: nowrap !important;
    }
    
    #node-sibling-btns {
        display: flex !important;
        flex-wrap: wrap !important;
        gap: 6px !important;
        justify-content: center !important;
    }
    
    #node-sibling-btns button {
        flex: 0 1 auto !important;
        min-width: 0 !important;
        font-size: 13px !important;
        padding: 6px 12px !important;
        white-space: nowrap !important;
    }
    
    #node-move-btns {
        display: flex !important;
        flex-wrap: wrap !important;
        gap: 6px !important;
        justify-content: center !important;
    }
    
    #node-move-btns button {
        flex: 0 1 auto !important;
        min-width: 0 !important;
        font-size: 13px !important;
        padding: 6px 12px !important;
        white-space: nowrap !important;
    }
    
    #node-color-btns {
        display: flex !important;
        flex-wrap: wrap !important;
        gap: 6px !important;
        justify-content: center !important;
    }
    
    #node-color-btns button {
        flex: 0 1 auto !important;
        min-width: 0 !important;
        font-size: 12px !important;
        padding: 4px 10px !important;
        white-space: nowrap !important;
    }

    #export-popup div:last-child button,
    #import-popup div:last-child button {
        font-size: 14px !important;
        padding: 6px 12px !important;
    }
}
