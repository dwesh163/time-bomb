import { useState, useEffect, useRef } from 'react'
import './App.css'

function App() {
    const [timeLeft, setTimeLeft] = useState(3600)
    const [code, setCode] = useState('')
    const [isDefused, setIsDefused] = useState(false)
    const [isExploded, setIsExploded] = useState(false)
    const [errorMessage, setErrorMessage] = useState('')
    const [wrongAttempts, setWrongAttempts] = useState(0)
    const [isStarted, setIsStarted] = useState(false)
    const canvasRef = useRef<HTMLCanvasElement>(null)

    useEffect(() => {
        if (!localStorage.getItem('bombSolution')) {
            localStorage.setItem('bombSolution', 'code')
        }

        const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()

        const createAmbientSound = () => {
            const oscillator = audioContext.createOscillator()
            const gainNode = audioContext.createGain()

            oscillator.connect(gainNode)
            gainNode.connect(audioContext.destination)

            oscillator.frequency.setValueAtTime(80 + Math.random() * 40, audioContext.currentTime)
            oscillator.type = 'sine'

            gainNode.gain.setValueAtTime(0, audioContext.currentTime)
            gainNode.gain.linearRampToValueAtTime(0.02, audioContext.currentTime + 0.1)
            gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 2)

            oscillator.start(audioContext.currentTime)
            oscillator.stop(audioContext.currentTime + 2)
        }

        const ambientInterval = setInterval(() => {
            if (Math.random() > 0.7) {
                createAmbientSound()
            }
        }, 1000)

        return () => {
            clearInterval(ambientInterval)
            if (audioContext.state !== 'closed') {
                audioContext.close()
            }
        }
    }, [])

    useEffect(() => {
        if (timeLeft > 0 && !isDefused && !isExploded && isStarted) {
            const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000)
            return () => clearTimeout(timer)
        } else if (timeLeft === 0 && !isDefused && isStarted) {
            setIsExploded(true)
        }
    }, [timeLeft, isDefused, isExploded, isStarted])

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return

        const ctx = canvas.getContext('2d')
        if (!ctx) return

        canvas.width = window.innerWidth
        canvas.height = window.innerHeight

        const columns = Math.floor(canvas.width / 20)
        const drops: number[] = []

        for (let i = 0; i < columns; i++) {
            drops[i] = 1
        }

        const chars = '01'

        function draw() {
            if (!ctx || !canvas) return

            ctx.fillStyle = 'rgba(0, 0, 0, 0.05)'
            ctx.fillRect(0, 0, canvas.width, canvas.height)

            ctx.fillStyle = '#0F0'
            ctx.font = '15px monospace'

            for (let i = 0; i < drops.length; i++) {
                const text = chars[Math.floor(Math.random() * chars.length)]
                ctx.fillText(text, i * 20, drops[i] * 20)

                if (drops[i] * 20 > canvas.height && Math.random() > 0.975) {
                    drops[i] = 0
                }
                drops[i]++
            }
        }

        const interval = setInterval(draw, 33)

        const handleResize = () => {
            canvas.width = window.innerWidth
            canvas.height = window.innerHeight
        }

        window.addEventListener('resize', handleResize)

        return () => {
            clearInterval(interval)
            window.removeEventListener('resize', handleResize)
        }
    }, [])

    const handleDefuse = () => {
        const solution = localStorage.getItem('bombSolution')
        if (code.toLowerCase() === solution?.toLowerCase()) {
            setIsDefused(true)
            setErrorMessage('')
        } else {
            setWrongAttempts(prev => prev + 1)
            setErrorMessage('Incorrect code')
            setTimeout(() => setErrorMessage(''), 2000)
        }
    }

    const formatTime = (seconds: number) => {
        const minutes = Math.floor(seconds / 60)
        const secs = seconds % 60
        return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }

    return (
        <div className="app">
            {isExploded && (
                <>
                    <div className="overlay" />
                    <video autoPlay loop muted className="boom-video">
                        <source src="/time-bomb/boom.mp4" type="video/mp4" />
                    </video>
                </>
            )}
            {!isExploded && <canvas ref={canvasRef} className="matrix-bg" />}

            <div className="bomb-container">
                {isExploded ? (
                    <></>
                ) : isDefused ? (
                    <div className="defused">
                        <h1>✅ DEFUSED!</h1>
                        <p>Well done!</p>
                    </div>
                ) : !isStarted ? (
                    <div className="bomb-interface">
                        <h1 className="title">TIME BOMB</h1>
                        <p className="start-description">Ready to defuse this bomb?</p>
                        <button onClick={() => setIsStarted(true)} className="start-btn">
                            START
                        </button>
                    </div>
                ) : (
                    <div className="bomb-interface">
                        <h1 className="title">DEFUSE</h1>
                        <div className="timer">{formatTime(timeLeft)}</div>
                        {wrongAttempts > 0 && (
                            <div className="attempts-counter">
                                Failed attempts: {wrongAttempts}
                            </div>
                        )}

                        <div className="defuse-panel">
                            <input
                                type="text"
                                value={code}
                                onChange={(e) => setCode(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleDefuse()}
                                placeholder="CODE"
                                className="code-input"
                                maxLength={10}
                            />
                            <button onClick={handleDefuse} className="defuse-btn">
                                DEFUSE
                            </button>
                        </div>

                        {errorMessage && <p className="error-message">{errorMessage}</p>}
                    </div>
                )}
            </div>
        </div >
    )
}

export default App
