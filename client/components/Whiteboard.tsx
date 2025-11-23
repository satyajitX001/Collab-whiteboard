'use client';

import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { toast } from 'sonner';
import {
    Pencil,
    Highlighter,
    Eraser,
    Trash2,
    Users,
    LogOut,
    ChevronDown,
    PenTool,
    Square,
    Circle,
    Minus,
    Type
} from 'lucide-react';
import { clsx } from 'clsx';

const socket = io(process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3001');

interface WhiteboardProps {
    roomId: string;
    userName: string;
    onLeave: () => void;
}

type Tool = 'pencil' | 'marker' | 'highlighter' | 'rectangle' | 'circle' | 'line' | 'text';

export default function Whiteboard({ roomId, userName, onLeave }: WhiteboardProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const previewCanvasRef = useRef<HTMLCanvasElement>(null);

    // State
    const [color, setColor] = useState('#000000');
    const [tool, setTool] = useState<Tool>('pencil');
    const [strokeWidth, setStrokeWidth] = useState(2);
    const [isDrawing, setIsDrawing] = useState(false);
    const [users, setUsers] = useState<{ userName: string }[]>([]);
    const [isUserListOpen, setIsUserListOpen] = useState(false);
    const [textInput, setTextInput] = useState<{ x: number; y: number; value: string } | null>(null);

    const startPos = useRef<{ x: number; y: number } | null>(null);

    useEffect(() => {
        socket.emit('join-room', { roomId, userName });

        const canvas = canvasRef.current;
        const previewCanvas = previewCanvasRef.current;
        if (!canvas || !previewCanvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const resize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            previewCanvas.width = window.innerWidth;
            previewCanvas.height = window.innerHeight;
        }
        resize();
        window.addEventListener('resize', resize);

        // Socket events
        socket.on('draw', (data) => {
            const { type, x0, y0, x1, y1, color, width, alpha, text } = data;
            if (type === 'freehand') {
                drawLine(ctx, x0, y0, x1, y1, color, width, alpha);
            } else if (type === 'text') {
                drawText(ctx, text, x0, y0, color, width);
            } else {
                drawShape(ctx, type, x0, y0, x1, y1, color, width, alpha);
            }
        });

        socket.on('clear', () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        });

        socket.on('user-joined', (name) => {
            toast.success(`${name} joined the room`);
        });

        socket.on('user-left', (name) => {
            toast.info(`${name} left the room`);
        });

        socket.on('update-users', (userList) => {
            setUsers(userList);
        });

        return () => {
            window.removeEventListener('resize', resize);
            socket.off('draw');
            socket.off('clear');
            socket.off('user-joined');
            socket.off('user-left');
            socket.off('update-users');
        };
    }, [roomId, userName]);

    // Copy Room ID on mount if host (simplification: just copy always for now or let user click)
    // Requirement: "when host start a room the room id should automatically copied"
    // We'll handle that in the parent component or here. Let's do it here if it's a new room.
    // Actually, simpler to just provide a copy button or do it on mount.

    const getToolSettings = () => {
        switch (tool) {
            case 'pencil': return { width: 2, alpha: 1 };
            case 'marker': return { width: 5, alpha: 1 };
            case 'highlighter': return { width: 15, alpha: 0.4 };
            case 'text': return { width: 20, alpha: 1 }; // width here acts as font size
            default: return { width: strokeWidth, alpha: 1 };
        }
    };

    const drawLine = (
        ctx: CanvasRenderingContext2D,
        x0: number,
        y0: number,
        x1: number,
        y1: number,
        color: string,
        width: number,
        alpha: number
    ) => {
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.globalAlpha = alpha;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
        ctx.closePath();
        ctx.globalAlpha = 1.0; // Reset
    };

    const drawShape = (
        ctx: CanvasRenderingContext2D,
        type: 'rectangle' | 'circle' | 'line',
        x0: number,
        y0: number,
        x1: number,
        y1: number,
        color: string,
        width: number,
        alpha: number
    ) => {
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.globalAlpha = alpha;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        if (type === 'rectangle') {
            ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
        } else if (type === 'circle') {
            const radius = Math.sqrt(Math.pow(x1 - x0, 2) + Math.pow(y1 - y0, 2));
            ctx.arc(x0, y0, radius, 0, 2 * Math.PI);
            ctx.stroke();
        } else if (type === 'line') {
            ctx.moveTo(x0, y0);
            ctx.lineTo(x1, y1);
            ctx.stroke();
        }

        ctx.closePath();
        ctx.globalAlpha = 1.0;
    };

    const drawText = (
        ctx: CanvasRenderingContext2D,
        text: string,
        x: number,
        y: number,
        color: string,
        fontSize: number
    ) => {
        ctx.font = `${fontSize}px sans-serif`;
        ctx.fillStyle = color;
        ctx.fillText(text, x, y);
    };

    const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
        // Prevent scrolling on touch devices
        if (e.type === 'touchstart') {
            // e.preventDefault(); // React synthetic events might not support this directly here, handled in CSS/passive listeners usually
        }

        const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

        if (tool === 'text') {
            setTextInput({ x: clientX, y: clientY, value: '' });
            return;
        }

        setIsDrawing(true);
        startPos.current = { x: clientX, y: clientY };
    };

    const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawing || !startPos.current || tool === 'text') return;

        const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

        const canvas = canvasRef.current;
        const previewCanvas = previewCanvasRef.current;
        if (!canvas || !previewCanvas) return;

        const ctx = canvas.getContext('2d');
        const previewCtx = previewCanvas.getContext('2d');
        if (!ctx || !previewCtx) return;

        const { width, alpha } = getToolSettings();
        const currentWidth = ['pencil', 'marker', 'highlighter'].includes(tool) ? width : strokeWidth;
        const currentAlpha = tool === 'highlighter' ? 0.4 : 1;

        if (['pencil', 'marker', 'highlighter'].includes(tool)) {
            drawLine(ctx, startPos.current.x, startPos.current.y, clientX, clientY, color, currentWidth, currentAlpha);
            socket.emit('draw', {
                type: 'freehand',
                x0: startPos.current.x,
                y0: startPos.current.y,
                x1: clientX,
                y1: clientY,
                color,
                width: currentWidth,
                alpha: currentAlpha,
                roomId
            });
            startPos.current = { x: clientX, y: clientY };
        } else {
            previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
            drawShape(
                previewCtx,
                tool as 'rectangle' | 'circle' | 'line',
                startPos.current.x,
                startPos.current.y,
                clientX,
                clientY,
                color,
                currentWidth,
                currentAlpha
            );
        }
    };

    const handleMouseUp = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawing || !startPos.current || tool === 'text') return;

        // For touchend, we might need to use changedTouches if touches is empty
        let clientX = startPos.current.x; // Fallback
        let clientY = startPos.current.y;

        if ('changedTouches' in e && e.changedTouches.length > 0) {
            clientX = e.changedTouches[0].clientX;
            clientY = e.changedTouches[0].clientY;
        } else if ('clientX' in e) {
            clientX = (e as React.MouseEvent).clientX;
            clientY = (e as React.MouseEvent).clientY;
        }

        const canvas = canvasRef.current;
        const previewCanvas = previewCanvasRef.current;
        if (!canvas || !previewCanvas) return;

        const ctx = canvas.getContext('2d');
        const previewCtx = previewCanvas.getContext('2d');
        if (!ctx || !previewCtx) return;

        if (!['pencil', 'marker', 'highlighter'].includes(tool)) {
            const currentWidth = strokeWidth;
            const currentAlpha = 1;

            drawShape(
                ctx,
                tool as 'rectangle' | 'circle' | 'line',
                startPos.current.x,
                startPos.current.y,
                clientX,
                clientY,
                color,
                currentWidth,
                currentAlpha
            );

            socket.emit('draw', {
                type: tool,
                x0: startPos.current.x,
                y0: startPos.current.y,
                x1: clientX,
                y1: clientY,
                color,
                width: currentWidth,
                alpha: currentAlpha,
                roomId
            });

            previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
        }

        setIsDrawing(false);
        startPos.current = null;
    };

    const handleTextSubmit = () => {
        if (!textInput || !textInput.value.trim()) {
            setTextInput(null);
            return;
        }

        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const fontSize = getToolSettings().width; // Use width from tool settings as font size
        drawText(ctx, textInput.value, textInput.x, textInput.y, color, fontSize);

        socket.emit('draw', {
            type: 'text',
            x0: textInput.x,
            y0: textInput.y,
            text: textInput.value,
            color,
            width: fontSize,
            roomId
        });

        setTextInput(null);
    };

    const clearBoard = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        socket.emit('clear', roomId);
    };

    const handleLeaveRoom = () => {
        socket.emit('leave-room');
        onLeave();
    };

    return (
        <div className="relative w-full h-screen overflow-hidden bg-gray-50">
            {/* Top Right User Menu */}
            <div className="absolute top-4 right-4 z-20">
                <div className="relative">
                    <button
                        onClick={() => setIsUserListOpen(!isUserListOpen)}
                        className="flex items-center gap-2 px-4 py-2 bg-white rounded-lg shadow-md hover:bg-gray-50 transition-all border border-gray-200"
                    >
                        <Users size={20} className="text-gray-600" />
                        <span className="font-semibold text-gray-700">{users.length}</span>
                        <ChevronDown size={16} className={clsx("text-gray-400 transition-transform", isUserListOpen && "rotate-180")} />
                    </button>

                    {isUserListOpen && (
                        <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden">
                            <div className="p-3 border-b border-gray-100 bg-gray-50">
                                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Connected Users</p>
                            </div>
                            <div className="max-h-60 overflow-y-auto">
                                {users.map((u, i) => (
                                    <div key={i} className="px-4 py-3 border-b border-gray-50 last:border-0 flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                        <span className="text-sm text-gray-700 font-medium">{u.userName} {u.userName === userName && '(You)'}</span>
                                    </div>
                                ))}
                            </div>
                            <div className="p-2 bg-gray-50 border-t border-gray-100">
                                <button
                                    onClick={handleLeaveRoom}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-md hover:bg-red-100 transition-colors text-sm font-medium"
                                >
                                    <LogOut size={16} />
                                    Leave Room
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Room Info Badge */}
            <div className="absolute top-4 left-4 z-20 bg-white/90 backdrop-blur px-4 py-2 rounded-lg shadow-sm border border-gray-200">
                <p className="text-xs text-gray-500 font-medium">Room ID</p>
                <div className="flex items-center gap-2">
                    <code className="text-sm font-bold text-gray-800">{roomId}</code>
                    <button
                        onClick={() => {
                            navigator.clipboard.writeText(roomId);
                            toast.success('Room ID copied to clipboard');
                        }}
                        className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                    >
                        Copy
                    </button>
                </div>
            </div>

            {/* Floating Toolbar */}
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex items-center gap-4 px-6 py-3 bg-white rounded-full shadow-xl border border-gray-200 overflow-x-auto max-w-[90vw]">
                {/* Tools */}
                <div className="flex items-center gap-1 pr-4 border-r border-gray-200">
                    <button
                        onClick={() => { setTool('pencil'); setStrokeWidth(2); }}
                        className={clsx("p-2 rounded-full transition-all", tool === 'pencil' ? "bg-blue-100 text-blue-600" : "text-gray-500 hover:bg-gray-100")}
                        title="Pencil"
                    >
                        <Pencil size={20} />
                    </button>
                    <button
                        onClick={() => { setTool('marker'); setStrokeWidth(5); }}
                        className={clsx("p-2 rounded-full transition-all", tool === 'marker' ? "bg-blue-100 text-blue-600" : "text-gray-500 hover:bg-gray-100")}
                        title="Marker"
                    >
                        <PenTool size={20} />
                    </button>
                    <button
                        onClick={() => { setTool('highlighter'); setStrokeWidth(15); }}
                        className={clsx("p-2 rounded-full transition-all", tool === 'highlighter' ? "bg-blue-100 text-blue-600" : "text-gray-500 hover:bg-gray-100")}
                        title="Highlighter"
                    >
                        <Highlighter size={20} />
                    </button>
                </div>

                {/* Shapes & Text */}
                <div className="flex items-center gap-1 pr-4 border-r border-gray-200">
                    <button
                        onClick={() => { setTool('line'); setStrokeWidth(2); }}
                        className={clsx("p-2 rounded-full transition-all", tool === 'line' ? "bg-blue-100 text-blue-600" : "text-gray-500 hover:bg-gray-100")}
                        title="Line"
                    >
                        <Minus size={20} className="-rotate-45" />
                    </button>
                    <button
                        onClick={() => { setTool('rectangle'); setStrokeWidth(2); }}
                        className={clsx("p-2 rounded-full transition-all", tool === 'rectangle' ? "bg-blue-100 text-blue-600" : "text-gray-500 hover:bg-gray-100")}
                        title="Rectangle"
                    >
                        <Square size={20} />
                    </button>
                    <button
                        onClick={() => { setTool('circle'); setStrokeWidth(2); }}
                        className={clsx("p-2 rounded-full transition-all", tool === 'circle' ? "bg-blue-100 text-blue-600" : "text-gray-500 hover:bg-gray-100")}
                        title="Circle"
                    >
                        <Circle size={20} />
                    </button>
                    <button
                        onClick={() => { setTool('text'); }}
                        className={clsx("p-2 rounded-full transition-all", tool === 'text' ? "bg-blue-100 text-blue-600" : "text-gray-500 hover:bg-gray-100")}
                        title="Text"
                    >
                        <Type size={20} />
                    </button>
                </div>

                {/* Color Picker */}
                <div className="flex items-center gap-2 pr-4 border-r border-gray-200">
                    <input
                        type="color"
                        value={color}
                        onChange={(e) => setColor(e.target.value)}
                        className="w-8 h-8 rounded-full cursor-pointer border-2 border-gray-200 p-0.5"
                        title="Choose Color"
                    />
                </div>

                {/* Width Slider */}
                <div className="flex items-center gap-2 w-32">
                    <div className="w-2 h-2 rounded-full bg-gray-400"></div>
                    <input
                        type="range"
                        min="1"
                        max="30"
                        value={strokeWidth}
                        onChange={(e) => setStrokeWidth(parseInt(e.target.value))}
                        className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                    <div className="w-4 h-4 rounded-full bg-gray-400"></div>
                </div>

                {/* Actions */}
                <div className="pl-4 border-l border-gray-200">
                    <button
                        onClick={clearBoard}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-full transition-colors"
                        title="Clear Board"
                    >
                        <Trash2 size={20} />
                    </button>
                </div>
            </div>

            <canvas
                ref={canvasRef}
                className="absolute top-0 left-0 w-full h-full"
            />
            {/* Preview Canvas for Shapes */}
            <canvas
                ref={previewCanvasRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onTouchStart={handleMouseDown}
                onTouchMove={handleMouseMove}
                onTouchEnd={handleMouseUp}
                className="absolute top-0 left-0 w-full h-full cursor-crosshair touch-none z-10"
            />

            {/* Text Input Overlay */}
            {textInput && (
                <input
                    autoFocus
                    className="absolute z-30 p-1 border border-blue-500 rounded bg-transparent outline-none text-xl font-sans"
                    style={{
                        left: textInput.x,
                        top: textInput.y,
                        color: color,
                        transform: 'translateY(-50%)'
                    }}
                    value={textInput.value}
                    onChange={(e) => setTextInput({ ...textInput, value: e.target.value })}
                    onBlur={handleTextSubmit}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') handleTextSubmit();
                        if (e.key === 'Escape') setTextInput(null);
                    }}
                />
            )}
        </div>
    );
}
