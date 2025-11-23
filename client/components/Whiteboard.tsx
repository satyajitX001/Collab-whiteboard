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
    PenTool
} from 'lucide-react';
import { clsx } from 'clsx';

const socket = io('http://localhost:3001');

interface WhiteboardProps {
    roomId: string;
    userName: string;
    onLeave: () => void;
}

type Tool = 'pencil' | 'marker' | 'highlighter';

export default function Whiteboard({ roomId, userName, onLeave }: WhiteboardProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // State
    const [color, setColor] = useState('#000000');
    const [tool, setTool] = useState<Tool>('pencil');
    const [strokeWidth, setStrokeWidth] = useState(2);
    const [isDrawing, setIsDrawing] = useState(false);
    const [users, setUsers] = useState<{ userName: string }[]>([]);
    const [isUserListOpen, setIsUserListOpen] = useState(false);

    const lastPos = useRef<{ x: number; y: number } | null>(null);

    useEffect(() => {
        socket.emit('join-room', { roomId, userName });

        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const resize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        }
        resize();
        window.addEventListener('resize', resize);

        // Socket events
        socket.on('draw', (data) => {
            const { x0, y0, x1, y1, color, width, alpha } = data;
            drawLine(x0, y0, x1, y1, color, width, alpha, false);
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
            default: return { width: 2, alpha: 1 };
        }
    };

    const drawLine = (
        x0: number,
        y0: number,
        x1: number,
        y1: number,
        color: string,
        width: number,
        alpha: number,
        emit: boolean
    ) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

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

        if (emit) {
            socket.emit('draw', { x0, y0, x1, y1, color, width, alpha, roomId });
        }
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        setIsDrawing(true);
        lastPos.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDrawing || !lastPos.current) return;

        const { width, alpha } = getToolSettings();
        // Use custom stroke width if set, otherwise default to tool
        // Requirement: "width setting". Let's use state strokeWidth if user adjusted it, else tool default?
        // Let's make the slider control the current tool's width.

        drawLine(lastPos.current.x, lastPos.current.y, e.clientX, e.clientY, color, strokeWidth, tool === 'highlighter' ? 0.4 : 1, true);
        lastPos.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseUp = () => {
        setIsDrawing(false);
        lastPos.current = null;
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
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex items-center gap-4 px-6 py-3 bg-white rounded-full shadow-xl border border-gray-200">
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
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                className="cursor-crosshair touch-none w-full h-full"
            />
        </div>
    );
}
