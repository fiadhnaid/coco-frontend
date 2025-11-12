import { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useRive } from "@rive-app/react-canvas";
import { Check, ArrowLeft, Mic, Pause, StopCircle, Star, Loader2, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import landingBg from "@assets/landing_background.webp";

type AppState = "nameEntry" | "contextMenu" | "editingContext" | "recording";
type ContextField = "eventDetails" | "goals" | "participants" | "tone";

interface Suggestion {
  text: string;
  type: string;
  priority: string;
  timestamp?: string;
}

interface TranscriptEntry {
  speaker: "user" | "coach";
  text: string;
  timestamp: string;
}

interface SessionSummary {
  stars: string[];
  wish: string;
  filler_percentage: number;
  takeaways: string[];
  summary_bullets: string[];
}

export default function Home() {
  const { toast } = useToast();
  
  // App state
  const [appState, setAppState] = useState<AppState>("nameEntry");
  const [editingField, setEditingField] = useState<ContextField | null>(null);
  
  // Context data
  const [userName, setUserName] = useState("");
  const [eventDetails, setEventDetails] = useState("");
  const [goals, setGoals] = useState("");
  const [participants, setParticipants] = useState("");
  const [tone, setTone] = useState("");
  
  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [transcriptEntries, setTranscriptEntries] = useState<TranscriptEntry[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isEndingSession, setIsEndingSession] = useState(false);

  // Feedback dialog state
  const [showFeedback, setShowFeedback] = useState(false);
  const [sessionSummary, setSessionSummary] = useState<SessionSummary | null>(null);

  // Loading state
  const [isLoadingSession, setIsLoadingSession] = useState(false);
  const [currentTip, setCurrentTip] = useState(0);
  const [loadingProgress, setLoadingProgress] = useState(0);

  // Conversation tips to display during loading
  const conversationTips = [
    "Maintain eye contact to show you're engaged",
    "Ask open-ended questions to encourage dialogue",
    "Listen actively before responding",
    "Mirror body language to build rapport",
    "Pause before responding to show thoughtfulness",
    "Use the other person's name to personalize",
    "Avoid interrupting - let them finish",
    "Show genuine curiosity about their perspective",
    "Acknowledge emotions before problem-solving",
    "Keep your tone warm and welcoming",
    "Match the other person's energy level — too high or low can break rapport.",
    "Share small vulnerabilities; it builds trust faster than perfection.",
    "Silence is powerful — people often reveal more if you simply wait.",
    "Notice metaphors they use; it reveals how they see the world.",
    "Summarize what you heard in your own words — it shows deep listening.",
    "Ask 'how did that feel?' instead of 'what happened?' to go deeper.",
    "Use humor lightly to diffuse tension and signal psychological safety.",
    "Compliment something specific and genuine — vague praise feels empty.",
    "If you disagree, start by finding one point of agreement first.",
    "Watch for micro-signals (tone shifts, pauses) — they often matter more than words.",
    "End on curiosity — a thoughtful question leaves a lasting impression.",
    "Match pacing — speak slightly slower in tense moments to calm the tone.",
    "Reflect back emotions as guesses: 'Sounds like that was frustrating?'",
    "Invite stories, not facts: 'Tell me about a time when…'",
    "Use 'we' language to create collaboration instead of competition.",
  ];

  const { RiveComponent, rive } = useRive({
    src: "/attached_assets/coco.riv?v=3",
    stateMachines: "State Machine 1",
    autoplay: true,
    onLoad: () => {
      console.log('✅ Rive animation loaded successfully');
    },
    onLoadError: (error) => {
      console.error('❌ Rive loading error:', error);
    },
  });

  // Fire "Loading" trigger when rive instance becomes available
  useEffect(() => {
    if (rive) {
      const inputs = rive.stateMachineInputs("State Machine 1");
      console.log("State machine inputs:", inputs?.map(i => i.name));

      const loadingTrigger = inputs?.find(i => i.name === "Loading");
      if (loadingTrigger) {
        console.log("Firing Loading trigger");
        loadingTrigger.fire();
      }
    }
  }, [rive]);

  // Handle Rive animation state changes based on recording/pause state
  useEffect(() => {
    if (!rive) return;

    const inputs = rive.stateMachineInputs("State Machine 1");
    if (!inputs) return;

    if (isRecording && !isPaused) {
      // Recording and not paused - trigger "listening" state
      const listeningTrigger = inputs.find(i =>
        i.name.toLowerCase() === "listening" ||
        i.name.toLowerCase() === "voice started" ||
        i.name === "Voice started"
      );
      if (listeningTrigger) {
        console.log("🎤 Firing listening/voice started trigger");
        listeningTrigger.fire();
      }
    } else if (isPaused) {
      // Paused - trigger "idle" state
      const idleTrigger = inputs.find(i =>
        i.name.toLowerCase() === "idle" ||
        i.name.toLowerCase() === "loading" ||
        i.name === "Loading"
      );
      if (idleTrigger) {
        console.log("⏸️ Firing idle/loading trigger");
        idleTrigger.fire();
      }
    }
  }, [rive, isRecording, isPaused]);

  // Load saved context from localStorage on mount
  useEffect(() => {
    const savedContext = localStorage.getItem("conversationContext");
    if (savedContext) {
      try {
        const context = JSON.parse(savedContext);
        if (context.userName) {
          setUserName(context.userName);
          setAppState("contextMenu"); // Skip to context menu if name exists
        }
        if (context.eventDetails) setEventDetails(context.eventDetails);
        if (context.goals) setGoals(context.goals);
        if (context.participants) setParticipants(context.participants);
        if (context.tone) setTone(context.tone);
      } catch (error) {
        console.error("Failed to load saved context:", error);
      }
    }
  }, []);

  // Cycle through tips while loading
  useEffect(() => {
    if (isLoadingSession) {
      const interval = setInterval(() => {
        setCurrentTip(Math.floor(Math.random() * conversationTips.length))
      }, 4000); // Change tip every 4 seconds

      return () => clearInterval(interval);
    }
  }, [isLoadingSession, conversationTips.length]);

  // Track loading progress from 0 to 30 seconds
  useEffect(() => {
    if (isLoadingSession) {
      setLoadingProgress(0);
      const startTime = Date.now();
      const duration = 30000; // 30 seconds

      const interval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min((elapsed / duration) * 100, 100);
        setLoadingProgress(progress);

        if (progress >= 100) {
          clearInterval(interval);
        }
      }, 100); // Update every 100ms for smooth animation

      return () => clearInterval(interval);
    } else {
      setLoadingProgress(0);
    }
  }, [isLoadingSession]);

  // Wake up Render instance on page load
  useEffect(() => {
    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

    // Call health check endpoint to spin up the Render instance
    fetch(`${backendUrl}/health`)
      .then(response => {
        if (response.ok) {
          console.log('✅ Backend is ready');
        }
      })
      .catch(error => {
        console.log('⏳ Backend is waking up...', error);
      });
  }, []);

  // Save context to localStorage whenever values change
  useEffect(() => {
    const context = { userName, eventDetails, goals, participants, tone };
    localStorage.setItem("conversationContext", JSON.stringify(context));
  }, [userName, eventDetails, goals, participants, tone]);

  // Confirm name and move to context menu
  const handleConfirmName = () => {
    if (userName.trim()) {
      setAppState("contextMenu");
    }
  };

  // Edit a specific context field
  const handleEditField = (field: ContextField) => {
    setEditingField(field);
    setAppState("editingContext");
  };

  // Go back to context menu
  const handleBackToMenu = () => {
    setEditingField(null);
    setAppState("contextMenu");
  };

  // Session and WebSocket refs
  const sessionIdRef = useRef<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);
  const suggestionsEndRef = useRef<HTMLDivElement | null>(null);

  // Start recording
  const handleStartRecording = async () => {
    // First, create a session with the backend
    try {
      setIsLoadingSession(true);
      setCurrentTip(Math.floor(Math.random() * conversationTips.length))
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

      const response = await fetch(`${backendUrl}/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          context: eventDetails || "General conversation",
          goal: goals || "Have a great conversation",
          user_name: userName,
          participants: participants || "",
          tone: tone || ""
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create session');
      }

      const data = await response.json();
      sessionIdRef.current = data.session_id;

      console.log('Session created:', data.session_id);

      // Now request microphone permission with specific settings for PCM
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000
        }
      });
      audioStreamRef.current = stream;

      setAppState("recording");
      setIsRecording(true);
      setIsPaused(false);
      setIsLoadingSession(false);

      // Connect to WebSocket
      const wsUrl = backendUrl.replace('http', 'ws');
      const ws = new WebSocket(`${wsUrl}/ws/${data.session_id}`);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connected');
      };

      ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        console.log('WebSocket message:', message);

        if (message.type === 'suggestion') {
          // Add new suggestion to the list (keep last 3)
          setSuggestions(prev => [{
            text: message.text,
            type: "tip",
            priority: "high",
            timestamp: message.timestamp
          }, ...prev].slice(0, 3));
        } else if (message.type === 'transcript') {
          // Add to transcript entries
          setTranscriptEntries(prev => [...prev, {
            speaker: message.speaker,
            text: message.text,
            timestamp: message.timestamp
          }]);
        } else if (message.type === 'audio') {
          // Play audio suggestion
          try {
            const audioData = atob(message.data);
            const arrayBuffer = new Uint8Array(audioData.length);
            for (let i = 0; i < audioData.length; i++) {
              arrayBuffer[i] = audioData.charCodeAt(i);
            }
            const blob = new Blob([arrayBuffer], { type: 'audio/mpeg' });
            const audioUrl = URL.createObjectURL(blob);
            const audio = new Audio(audioUrl);
            audio.play();
          } catch (error) {
            console.error('Error playing audio:', error);
          }
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        toast({
          title: "Connection Error",
          description: "Failed to connect to the backend. Please make sure the backend is running.",
          variant: "destructive"
        });
      };

      ws.onclose = () => {
        console.log('WebSocket closed');
      };

      // Use Web Audio API to convert to PCM format
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      audioProcessorRef.current = processor;

      source.connect(processor);
      processor.connect(audioContext.destination);

      processor.onaudioprocess = (e) => {
        if (ws.readyState === WebSocket.OPEN && !isPaused) {
          // Get PCM data
          const inputData = e.inputBuffer.getChannelData(0);

          // Convert Float32Array to Int16Array (PCM 16-bit)
          const pcm16 = new Int16Array(inputData.length);
          for (let i = 0; i < inputData.length; i++) {
            const s = Math.max(-1, Math.min(1, inputData[i]));
            pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
          }

          // Send PCM audio to backend
          ws.send(pcm16.buffer);
        }
      };
    } catch (error: any) {
      console.error('Microphone permission error:', error);
      setIsLoadingSession(false);

      // Show detailed instructions based on the error
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        toast({
          title: "Microphone Access Blocked",
          description: "Please click the 🔒 or ⓘ icon in your browser's address bar and allow microphone access, then try again.",
          variant: "destructive",
          duration: 10000,
        });
      } else if (error.name === 'NotFoundError') {
        toast({
          title: "No Microphone Found",
          description: "Please connect a microphone to use this feature.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Microphone Error",
          description: error.message || "Could not access microphone. Please check your browser settings.",
          variant: "destructive",
        });
      }
    }
  };

  // Pause/Resume recording
  const handleTogglePause = () => {
    if (isPaused) {
      // Resume
      setIsPaused(false);
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume();
      }
    } else {
      // Pause
      setIsPaused(true);
      if (audioContextRef.current && audioContextRef.current.state === 'running') {
        audioContextRef.current.suspend();
      }
    }
  };

  // End session
  const handleEndSession = async () => {
    setIsEndingSession(true);
    setIsRecording(false);
    setIsPaused(false);

    // Stop audio context and processor
    if (audioProcessorRef.current) {
      audioProcessorRef.current.disconnect();
      audioProcessorRef.current = null;
    }

    if (audioContextRef.current) {
      await audioContextRef.current.close();
      audioContextRef.current = null;
    }

    // Stop audio stream
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(track => track.stop());
      audioStreamRef.current = null;
    }

    // Close WebSocket
    if (wsRef.current) {
      wsRef.current.send(JSON.stringify({ type: 'stop' }));
      wsRef.current.close();
      wsRef.current = null;
    }

    // Get session summary from backend
    if (sessionIdRef.current) {
      try {
        const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';
        const response = await fetch(`${backendUrl}/session/${sessionIdRef.current}/finish`, {
          method: 'POST'
        });

        if (response.ok) {
          const summary = await response.json();
          console.log('Session summary:', summary);
          setSessionSummary(summary);
          setShowFeedback(true);
        }
      } catch (error) {
        console.error('Error getting session summary:', error);
        toast({
          title: "Error",
          description: "Failed to get session summary",
          variant: "destructive"
        });
      } finally {
        setIsEndingSession(false);
      }
    }

    setTranscriptEntries([]);
    setSuggestions([]);
    sessionIdRef.current = null;
    setAppState("contextMenu");
  };

  // Auto-scroll transcript when new entries arrive
  useEffect(() => {
    if (transcriptEndRef.current) {
      transcriptEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [transcriptEntries]);

  // Auto-scroll suggestions when new ones arrive
  useEffect(() => {
    if (suggestionsEndRef.current) {
      suggestionsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [suggestions]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioProcessorRef.current) {
        audioProcessorRef.current.disconnect();
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  return (
    <div
      className="min-h-screen flex flex-col p-4 bg-black"
      style={{
        backgroundImage: `url(${landingBg})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      {/* Top Header */}
      {/* <div className="w-full text-center pt-4 pb-2">
        <p className="text-sm font-medium text-[#ffffff]" data-testid="text-header">
          Conversation Companion
        </p>
      </div> */}

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center">
        <div className="w-full max-w-md mx-auto">
          <Card className="p-6 space-y-4 text-center bg-transparent border-0 shadow-none">
            {/* Vertical spacing for non-name entry states */}
            {appState !== "nameEntry" && <div className="h-[150px]" />}

            {/* Rive Animation */}
          <div className="flex justify-center -mt-2">
            <div className="w-80 h-80">
              <RiveComponent className="w-full h-full" />
            </div>
          </div>

            {/* Title */}
            <div className="space-y-2">
            <h1 className="text-5xl font-bold text-[#ffffff] tracking-tight">
              COCO
            </h1>
            <p className="text-sm text-[#ffffff]">
              Your conversation coach
            </p>
          </div>

                      {/* NAME ENTRY STATE */}
            {appState === "nameEntry" && (
            <div className="space-y-4 pt-2">
              <Input
                placeholder="What's your name?"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                className="h-12 text-base text-center bg-white/90 rounded-full focus-visible:ring-yellow-400"
                onKeyDown={(e) => e.key === 'Enter' && handleConfirmName()}
                autoFocus
                data-testid="input-user-name"
              />
              <Button
                onClick={handleConfirmName}
                disabled={!userName.trim()}
                size="lg"
                className="w-full h-14 text-base font-semibold rounded-full bg-[#FFE8C9] hover:bg-[#FFE8C9]/90 text-black border-0"
                data-testid="button-confirm-name"
              >
                Confirm
              </Button>
            </div>
          )}

          {/* CONTEXT MENU STATE */}
          {appState === "contextMenu" && (
            <div className="space-y-2 pt-2">
              <Button
                variant="ghost"
                onClick={() => setAppState("nameEntry")}
                className="text-[#ffffff] hover:bg-white/10 mb-2"
                data-testid="button-back-to-name"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>

              <Button
                variant="outline"
                onClick={() => handleEditField("eventDetails")}
                className={`w-full h-12 justify-between rounded-full text-sm font-medium ${eventDetails ? 'border-0' : 'border-2 border-[#FFE8C9]/50 bg-[#FFE8C9]/10'}`}
                data-testid="pill-event-details"
              >
                <span className="flex items-center gap-2 text-[#ffffff]">
                  {eventDetails && <Check className="h-4 w-4 text-primary" />}
                  <span className={eventDetails ? '' : 'text-[#FFE8C9]'}>
                    {eventDetails ? 'Conversation Details' : 'Conversation Details'}
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 text-[#FFE8C9]/70" />
              </Button>

              <Button
                variant="outline"
                onClick={() => handleEditField("goals")}
                className={`w-full h-12 justify-between rounded-full text-sm font-medium ${goals ? 'border-0' : 'border-2 border-[#FFE8C9]/50 bg-[#FFE8C9]/10'}`}
                data-testid="pill-goals"
              >
                <span className="flex items-center gap-2 text-[#ffffff]">
                  {goals && <Check className="h-4 w-4 text-primary" />}
                  <span className={goals ? '' : 'text-[#FFE8C9]'}>
                    {goals ? 'Your Goals' : 'Your Goals'}
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 text-[#FFE8C9]/70" />
              </Button>

              <Button
                variant="outline"
                onClick={() => handleEditField("participants")}
                className={`w-full h-12 justify-between rounded-full text-sm font-medium ${participants ? 'border-0' : 'border-2 border-[#FFE8C9]/50 bg-[#FFE8C9]/10'}`}
                data-testid="pill-participants"
              >
                <span className="flex items-center gap-2 text-[#ffffff]">
                  {participants && <Check className="h-4 w-4 text-primary" />}
                  <span className={participants ? '' : 'text-[#FFE8C9]'}>
                    {participants ? 'Participants & Relationships' : 'Participants & Relationships'}
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 text-[#FFE8C9]/70" />
              </Button>

              <Button
                variant="outline"
                onClick={() => handleEditField("tone")}
                className={`w-full h-12 justify-between rounded-full text-sm font-medium ${tone ? 'border-0' : 'border-2 border-[#FFE8C9]/50 bg-[#FFE8C9]/10'}`}
                data-testid="pill-tone"
              >
                <span className="flex items-center gap-2 text-[#ffffff]">
                  {tone && <Check className="h-4 w-4 text-primary" />}
                  <span className={tone ? '' : 'text-[#FFE8C9]'}>
                    {tone ? 'Tone' : 'Tone'}
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 text-[#FFE8C9]/70" />
              </Button>

              <div className="pt-2">
                <Button
                  onClick={handleStartRecording}
                  size="lg"
                  className="w-full h-14 text-base font-semibold rounded-full bg-[#FFE8C9] hover:bg-[#FFE8C9]/90 text-black border-0"
                  data-testid="button-start-session"
                >
                  Let's Talk!
                </Button>
              </div>
            </div>
          )}

          {/* EDITING CONTEXT STATE */}
          {appState === "editingContext" && editingField && (
            <div className="space-y-4 pt-2">
              <Button
                variant="ghost"
                onClick={handleBackToMenu}
                className="text-[#ffffff] hover:bg-white/10"
                data-testid="button-back"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>

              {editingField === "eventDetails" && (
                <Input
                  placeholder="e.g. Salary negotiation call"
                  value={eventDetails}
                  onChange={(e) => setEventDetails(e.target.value)}
                  className="h-12 text-base bg-white/90 rounded-full focus-visible:ring-yellow-400"
                  autoFocus
                  data-testid="input-event-details"
                />
              )}

              {editingField === "goals" && (
                <Textarea
                  placeholder="What do you want to achieve?"
                  value={goals}
                  onChange={(e) => setGoals(e.target.value)}
                  className="min-h-24 text-base bg-white/90 rounded-3xl focus-visible:ring-yellow-400"
                  autoFocus
                  data-testid="input-goals"
                />
              )}

              {editingField === "participants" && (
                <Textarea
                  placeholder="Who will you be talking to?"
                  value={participants}
                  onChange={(e) => setParticipants(e.target.value)}
                  className="min-h-24 text-base bg-white/90 rounded-3xl focus-visible:ring-yellow-400"
                  autoFocus
                  data-testid="input-participants"
                />
              )}

              {editingField === "tone" && (
                <Input
                  placeholder="Happy, professional etc"
                  value={tone}
                  onChange={(e) => setTone(e.target.value)}
                  className="h-12 text-base bg-white/90 rounded-full focus-visible:ring-yellow-400"
                  autoFocus
                  data-testid="input-tone"
                />
              )}

              <Button
                onClick={handleBackToMenu}
                size="lg"
                className="w-full h-14 text-base font-semibold rounded-full bg-[#FFE8C9] hover:bg-[#FFE8C9]/90 text-black border-0"
                data-testid="button-save-context"
              >
                Save
              </Button>
            </div>
          )}

          {/* RECORDING STATE */}
          {appState === "recording" && (
            <div className="space-y-3 pt-2 w-full">
              {/* Recording indicator */}
              <div className="flex items-center justify-center gap-2 text-[#ffffff]">
                {!isEndingSession && (
                  <>
                    <div className={`w-3 h-3 rounded-full ${isPaused ? 'bg-yellow-500' : 'bg-red-500 animate-pulse'}`} />
                    <span className="text-sm font-medium">
                      {isPaused ? 'Paused' : 'Recording...'}
                    </span>
                  </>
                )}
              </div>

              {/* Writing summary indicator */}
              {isEndingSession && (
                <div className="flex flex-col items-center justify-center gap-3 py-8">
                  <Loader2 className="h-12 w-12 animate-spin text-[#FFE8C9]" />
                  <span className="text-xl font-semibold text-[#ffffff]">Writing feedback...</span>

                  <div className="h-20 w-full" />
                </div>
              )}

              {/* Live Suggestions */}
              {!isEndingSession && (
              <div className="space-y-2">
                <p className="text-xs text-[#ffffff] font-semibold">💡 Live Coaching</p>
                <ScrollArea className="h-24 w-full rounded-lg bg-white/10 p-3">
                  {suggestions.length > 0 ? (
                    <div className="space-y-2">
                      {suggestions.map((suggestion, index) => (
                        <div
                          key={`${suggestion.timestamp}-${index}`}
                          className="bg-[#e3f2fd] text-black px-3 py-2 rounded-lg text-sm"
                          data-testid={`suggestion-${index}`}
                        >
                          <strong className="text-[#1976d2]">💡 Coach:</strong> {suggestion.text}
                        </div>
                      ))}
                      <div ref={suggestionsEndRef} />
                    </div>
                  ) : (
                    <p className="text-[#ffffff]/50 text-xs text-center py-2">
                      Listening... suggestions will appear here
                    </p>
                  )}
                </ScrollArea>
              </div>
              )}

              {/* Live Transcript */}
              {!isEndingSession && (
              <div className="space-y-2">
                <p className="text-xs text-[#ffffff] font-semibold">📝 Transcript</p>
                <ScrollArea className="h-40 w-full rounded-lg bg-white/90 p-3">
                  {transcriptEntries.length > 0 ? (
                    <div className="space-y-2">
                      {transcriptEntries.map((entry, index) => (
                        <div
                          key={`${entry.timestamp}-${index}`}
                          className="text-sm"
                        >
                          <strong className={entry.speaker === 'user' ? 'text-[#1976d2]' : 'text-[#388e3c]'}>
                            {entry.speaker === 'user' ? 'You' : 'Coach'}:
                          </strong>{' '}
                          <span className="text-black">{entry.text}</span>
                        </div>
                      ))}
                      <div ref={transcriptEndRef} />
                    </div>
                  ) : (
                    <p className="text-gray-500 text-xs text-center py-4">
                      Start speaking... your conversation will appear here
                    </p>
                  )}
                </ScrollArea>
              </div>
              )}

              {/* Control buttons */}
              {!isEndingSession && (
              <div className="flex gap-2">
                <Button
                  onClick={handleTogglePause}
                  size="lg"
                  className="flex-1 h-12 text-sm font-semibold rounded-full bg-white/90 hover:bg-white text-black border-0"
                  data-testid="button-toggle-pause"
                >
                  {isPaused ? <Mic className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                  <span className="ml-2">{isPaused ? 'Resume' : 'Pause'}</span>
                </Button>
                <Button
                  onClick={handleEndSession}
                  disabled={isEndingSession}
                  size="lg"
                  className="flex-1 h-12 text-sm font-semibold rounded-full bg-red-500 hover:bg-red-600 text-white border-0 disabled:opacity-50"
                  data-testid="button-end-session"
                >
                  {isEndingSession ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <StopCircle className="h-4 w-4" />
                  )}
                  <span className="ml-2">End</span>
                </Button>
              </div>
              )}
            </div>
          )}
          </Card>
        </div>
      </div>

      {/* Loading Dialog */}
      <Dialog open={isLoadingSession} onOpenChange={setIsLoadingSession}>
        <DialogContent
          className="max-w-lg bg-black/95 border-2 border-[#FFE8C9] text-white"
          onPointerDownOutside={(e) => e.preventDefault()}
        >
          <div className="flex flex-col items-center justify-center py-10 space-y-8">
            {/* Circular Progress Indicator */}
            <div className="relative flex items-center justify-center">
              <svg className="w-40 h-40 transform -rotate-90">
                {/* Background circle */}
                <circle
                  cx="80"
                  cy="80"
                  r="70"
                  stroke="#FFE8C9"
                  strokeWidth="8"
                  fill="none"
                  opacity="0.2"
                />
                {/* Progress circle */}
                <circle
                  cx="80"
                  cy="80"
                  r="70"
                  stroke="#FFE8C9"
                  strokeWidth="8"
                  fill="none"
                  strokeDasharray={`${2 * Math.PI * 70}`}
                  strokeDashoffset={`${2 * Math.PI * 70 * (1 - loadingProgress / 100)}`}
                  strokeLinecap="round"
                  className="transition-all duration-100 ease-linear"
                />
              </svg>
              {/* Center text */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-4xl font-bold text-[#FFE8C9]">
                  {Math.round(loadingProgress)}%
                </span>
                <span className="text-xs text-gray-400 mt-1">
                  {Math.round((loadingProgress / 100) * 30)}s / 30s
                </span>
              </div>
            </div>

            {/* Title */}
            <div className="text-center space-y-2">
              <h3 className="text-2xl font-bold text-[#FFE8C9]">Waking up COCO...</h3>
              <p className="text-sm text-gray-400">Please wait while we prepare your session</p>
            </div>

            {/* Conversation Tips - More Prominent */}
            <div className="w-full bg-[#FFE8C9]/10 border-2 border-[#FFE8C9] rounded-2xl p-6 min-h-[120px] flex items-center justify-center backdrop-blur-sm">
              <div className="text-center space-y-2">
                <p className="text-xs font-bold text-[#FFE8C9] uppercase tracking-wider">
                  💡 Conversation Tip
                </p>
                <p className="text-lg font-medium text-white leading-relaxed">
                  {conversationTips[currentTip]}
                </p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Feedback Dialog */}
      <Dialog open={showFeedback} onOpenChange={setShowFeedback}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-center">Session Complete!</DialogTitle>
            <DialogDescription className="text-center">
              Here's your feedback from COCO
            </DialogDescription>
          </DialogHeader>

          {sessionSummary && (
            <div className="space-y-6 py-4">
              {/* Stars */}
              <div className="space-y-3">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                  Two Stars (What went well)
                </h3>
                <ul className="space-y-2">
                  {sessionSummary.stars.map((star, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="text-yellow-500 mt-1">⭐</span>
                      <span className="text-sm">{star}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Wish */}
              <div className="space-y-3">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Star className="h-5 w-5 text-blue-500" />
                  One Wish (Area for improvement)
                </h3>
                <p className="text-sm bg-blue-50 p-3 rounded-lg border border-blue-200">
                  {sessionSummary.wish}
                </p>
              </div>

              {/* Filler Percentage */}
              <div className="space-y-3">
                <h3 className="text-lg font-semibold">Filler Word Usage</h3>
                <div className="bg-gray-50 p-4 rounded-lg border">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Filler words (um, uh, like, etc.)</span>
                    <span className="text-2xl font-bold text-purple-600">
                      {sessionSummary.filler_percentage}%
                    </span>
                  </div>
                  <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-purple-600 h-2 rounded-full transition-all"
                      style={{ width: `${Math.min(sessionSummary.filler_percentage, 100)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Takeaways */}
              <div className="space-y-3">
                <h3 className="text-lg font-semibold">Key Takeaways</h3>
                <ul className="space-y-2">
                  {sessionSummary.takeaways.map((takeaway, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="text-green-500 mt-1">✓</span>
                      <span className="text-sm">{takeaway}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Summary */}
              <div className="space-y-3">
                <h3 className="text-lg font-semibold">Conversation Summary</h3>
                <ul className="space-y-2">
                  {sessionSummary.summary_bullets.map((bullet, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="text-gray-500 mt-1">•</span>
                      <span className="text-sm">{bullet}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <Button
                onClick={() => setShowFeedback(false)}
                className="w-full bg-[#FFE8C9] hover:bg-[#FFE8C9]/90 text-black font-semibold"
              >
                Close
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
