import { useState, useEffect, useCallback, useRef } from 'react'

interface Position {
  x: number
  y: number
}

interface Invader extends Position {
  id: number
  alive: boolean
  type: number
}

interface Bullet extends Position {
  id: number
}

interface EnemyBullet extends Position {
  id: number
}

const GAME_WIDTH = 600
const GAME_HEIGHT = 500
const PLAYER_WIDTH = 40
const PLAYER_HEIGHT = 20
const INVADER_WIDTH = 30
const INVADER_HEIGHT = 20
const BULLET_WIDTH = 4
const BULLET_HEIGHT = 12
const INVADER_ROWS = 4
const INVADER_COLS = 8
const INVADER_SPACING_X = 50
const INVADER_SPACING_Y = 40

function App() {
  const [gameState, setGameState] = useState<'menu' | 'playing' | 'gameover' | 'win'>('menu')
  const [playerX, setPlayerX] = useState(GAME_WIDTH / 2 - PLAYER_WIDTH / 2)
  const [bullets, setBullets] = useState<Bullet[]>([])
  const [enemyBullets, setEnemyBullets] = useState<EnemyBullet[]>([])
  const [invaders, setInvaders] = useState<Invader[]>([])
  const [score, setScore] = useState(0)
  const [lives, setLives] = useState(3)
  const [invaderDirection, setInvaderDirection] = useState(1)
  const [level, setLevel] = useState(1)
  
  const keysPressed = useRef<Set<string>>(new Set())
  const bulletIdRef = useRef(0)
  const enemyBulletIdRef = useRef(0)
  const lastShotTime = useRef(0)
  const gameLoopRef = useRef<number>(0)

  const initializeInvaders = useCallback(() => {
    const newInvaders: Invader[] = []
    let id = 0
    for (let row = 0; row < INVADER_ROWS; row++) {
      for (let col = 0; col < INVADER_COLS; col++) {
        newInvaders.push({
          id: id++,
          x: col * INVADER_SPACING_X + 50,
          y: row * INVADER_SPACING_Y + 50,
          alive: true,
          type: row % 3
        })
      }
    }
    return newInvaders
  }, [])

  const startGame = useCallback(() => {
    setGameState('playing')
    setPlayerX(GAME_WIDTH / 2 - PLAYER_WIDTH / 2)
    setBullets([])
    setEnemyBullets([])
    setInvaders(initializeInvaders())
    setScore(0)
    setLives(3)
    setInvaderDirection(1)
    setLevel(1)
  }, [initializeInvaders])

  const shoot = useCallback(() => {
    const now = Date.now()
    if (now - lastShotTime.current < 300) return
    lastShotTime.current = now
    
    setBullets(prev => [...prev, {
      id: bulletIdRef.current++,
      x: playerX + PLAYER_WIDTH / 2 - BULLET_WIDTH / 2,
      y: GAME_HEIGHT - PLAYER_HEIGHT - 30
    }])
  }, [playerX])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysPressed.current.add(e.key)
      if (e.key === ' ' && gameState === 'playing') {
        e.preventDefault()
        shoot()
      }
      if (e.key === 'Enter' && gameState !== 'playing') {
        startGame()
      }
    }
    
    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current.delete(e.key)
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [gameState, shoot, startGame])

  useEffect(() => {
    if (gameState !== 'playing') return

    const gameLoop = () => {
      // Player movement
      if (keysPressed.current.has('ArrowLeft') || keysPressed.current.has('a')) {
        setPlayerX(prev => Math.max(0, prev - 5))
      }
      if (keysPressed.current.has('ArrowRight') || keysPressed.current.has('d')) {
        setPlayerX(prev => Math.min(GAME_WIDTH - PLAYER_WIDTH, prev + 5))
      }

      // Update bullets
      setBullets(prev => prev
        .map(b => ({ ...b, y: b.y - 8 }))
        .filter(b => b.y > -BULLET_HEIGHT)
      )

      // Update enemy bullets
      setEnemyBullets(prev => prev
        .map(b => ({ ...b, y: b.y + 4 }))
        .filter(b => b.y < GAME_HEIGHT)
      )

      gameLoopRef.current = requestAnimationFrame(gameLoop)
    }

    gameLoopRef.current = requestAnimationFrame(gameLoop)
    return () => cancelAnimationFrame(gameLoopRef.current)
  }, [gameState])

  // Invader movement
  useEffect(() => {
    if (gameState !== 'playing') return

    const moveInvaders = setInterval(() => {
      setInvaders(prev => {
        const aliveInvaders = prev.filter(i => i.alive)
        if (aliveInvaders.length === 0) return prev

        const minX = Math.min(...aliveInvaders.map(i => i.x))
        const maxX = Math.max(...aliveInvaders.map(i => i.x))
        
        let newDirection = invaderDirection
        let moveDown = false

        if (maxX + INVADER_WIDTH >= GAME_WIDTH - 10 && invaderDirection === 1) {
          newDirection = -1
          moveDown = true
        } else if (minX <= 10 && invaderDirection === -1) {
          newDirection = 1
          moveDown = true
        }

        if (newDirection !== invaderDirection) {
          setInvaderDirection(newDirection)
        }

        return prev.map(inv => ({
          ...inv,
          x: inv.x + newDirection * 10,
          y: moveDown ? inv.y + 15 : inv.y
        }))
      })
    }, 500 - level * 50)

    return () => clearInterval(moveInvaders)
  }, [gameState, invaderDirection, level])

  // Enemy shooting
  useEffect(() => {
    if (gameState !== 'playing') return

    const enemyShoot = setInterval(() => {
      setInvaders(prev => {
        const aliveInvaders = prev.filter(i => i.alive)
        if (aliveInvaders.length === 0) return prev

        const shooter = aliveInvaders[Math.floor(Math.random() * aliveInvaders.length)]
        setEnemyBullets(bullets => [...bullets, {
          id: enemyBulletIdRef.current++,
          x: shooter.x + INVADER_WIDTH / 2 - BULLET_WIDTH / 2,
          y: shooter.y + INVADER_HEIGHT
        }])
        return prev
      })
    }, 1500 - level * 100)

    return () => clearInterval(enemyShoot)
  }, [gameState, level])

  // Collision detection
  useEffect(() => {
    if (gameState !== 'playing') return

    // Bullet-Invader collision
    setBullets(prevBullets => {
      let newBullets = [...prevBullets]
      
      setInvaders(prevInvaders => {
        return prevInvaders.map(inv => {
          if (!inv.alive) return inv
          
          const hitBullet = newBullets.find(b => 
            b.x < inv.x + INVADER_WIDTH &&
            b.x + BULLET_WIDTH > inv.x &&
            b.y < inv.y + INVADER_HEIGHT &&
            b.y + BULLET_HEIGHT > inv.y
          )
          
          if (hitBullet) {
            newBullets = newBullets.filter(b => b.id !== hitBullet.id)
            setScore(s => s + (3 - inv.type) * 10)
            return { ...inv, alive: false }
          }
          return inv
        })
      })
      
      return newBullets
    })

    // Enemy bullet-Player collision
    setEnemyBullets(prev => {
      const hitBullet = prev.find(b =>
        b.x < playerX + PLAYER_WIDTH &&
        b.x + BULLET_WIDTH > playerX &&
        b.y < GAME_HEIGHT - 10 &&
        b.y + BULLET_HEIGHT > GAME_HEIGHT - PLAYER_HEIGHT - 20
      )
      
      if (hitBullet) {
        setLives(l => {
          if (l <= 1) {
            setGameState('gameover')
            return 0
          }
          return l - 1
        })
        return prev.filter(b => b.id !== hitBullet.id)
      }
      return prev
    })

    // Check win condition
    setInvaders(prev => {
      const aliveCount = prev.filter(i => i.alive).length
      if (aliveCount === 0 && prev.length > 0) {
        setLevel(l => l + 1)
        setEnemyBullets([])
        return initializeInvaders()
      }
      
      // Check if invaders reached bottom
      const reachedBottom = prev.some(i => i.alive && i.y + INVADER_HEIGHT >= GAME_HEIGHT - PLAYER_HEIGHT - 40)
      if (reachedBottom) {
        setGameState('gameover')
      }
      
      return prev
    })
  }, [gameState, playerX, initializeInvaders])

  const renderInvader = (type: number) => {
    const colors = ['text-green-400', 'text-yellow-400', 'text-red-400']
    const shapes = ['👾', '👽', '🛸']
    return <span className={colors[type]}>{shapes[type]}</span>
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-purple-900 to-black flex flex-col items-center justify-center p-4">
      <h1 className="text-4xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 via-blue-500 to-purple-500 mb-4">
        SPACE INVADERS
      </h1>
      
      <div className="flex gap-8 mb-4 text-white text-lg">
        <div className="flex items-center gap-2">
          <span className="text-yellow-400">SCORE:</span>
          <span className="font-mono text-green-400">{score.toString().padStart(6, '0')}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-yellow-400">LIVES:</span>
          <span className="text-red-400">{'❤️'.repeat(lives)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-yellow-400">LEVEL:</span>
          <span className="font-mono text-blue-400">{level}</span>
        </div>
      </div>

      <div 
        className="relative bg-black border-4 border-purple-500 rounded-lg overflow-hidden shadow-2xl shadow-purple-500/30"
        style={{ width: GAME_WIDTH, height: GAME_HEIGHT }}
      >
        {/* Stars background */}
        <div className="absolute inset-0">
          {Array.from({ length: 50 }).map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-white rounded-full opacity-50"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animation: `blink ${1 + Math.random() * 2}s infinite`
              }}
            />
          ))}
        </div>

        {gameState === 'menu' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-20">
            <div className="text-6xl mb-8 animate-bounce">👾</div>
            <p className="text-green-400 text-xl mb-4">Press ENTER to Start</p>
            <div className="text-gray-400 text-sm space-y-2 text-center">
              <p>← → or A/D to move</p>
              <p>SPACE to shoot</p>
            </div>
          </div>
        )}

        {gameState === 'gameover' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-20">
            <div className="text-6xl mb-4">💀</div>
            <h2 className="text-red-500 text-4xl font-bold mb-4">GAME OVER</h2>
            <p className="text-white text-xl mb-2">Final Score: {score}</p>
            <p className="text-green-400 text-lg blink">Press ENTER to Play Again</p>
          </div>
        )}

        {gameState === 'playing' && (
          <>
            {/* Invaders */}
            {invaders.filter(i => i.alive).map(invader => (
              <div
                key={invader.id}
                className="absolute text-2xl transition-all duration-100"
                style={{
                  left: invader.x,
                  top: invader.y,
                  width: INVADER_WIDTH,
                  height: INVADER_HEIGHT
                }}
              >
                {renderInvader(invader.type)}
              </div>
            ))}

            {/* Player */}
            <div
              className="absolute"
              style={{
                left: playerX,
                bottom: 10,
                width: PLAYER_WIDTH,
                height: PLAYER_HEIGHT
              }}
            >
              <div className="w-full h-full flex items-center justify-center text-3xl">
                🚀
              </div>
            </div>

            {/* Player Bullets */}
            {bullets.map(bullet => (
              <div
                key={bullet.id}
                className="absolute bg-gradient-to-t from-yellow-500 to-white rounded-full shadow-lg shadow-yellow-500/50"
                style={{
                  left: bullet.x,
                  top: bullet.y,
                  width: BULLET_WIDTH,
                  height: BULLET_HEIGHT
                }}
              />
            ))}

            {/* Enemy Bullets */}
            {enemyBullets.map(bullet => (
              <div
                key={bullet.id}
                className="absolute bg-gradient-to-b from-red-500 to-orange-500 rounded-full shadow-lg shadow-red-500/50"
                style={{
                  left: bullet.x,
                  top: bullet.y,
                  width: BULLET_WIDTH,
                  height: BULLET_HEIGHT
                }}
              />
            ))}
          </>
        )}
      </div>

      {/* Mobile Controls */}
      <div className="mt-6 flex gap-4 md:hidden">
        <button
          className="w-16 h-16 bg-purple-600 rounded-full text-white text-2xl active:bg-purple-700 shadow-lg"
          onTouchStart={() => keysPressed.current.add('ArrowLeft')}
          onTouchEnd={() => keysPressed.current.delete('ArrowLeft')}
        >
          ←
        </button>
        <button
          className="w-20 h-16 bg-red-600 rounded-full text-white text-sm active:bg-red-700 shadow-lg"
          onTouchStart={() => shoot()}
        >
          FIRE
        </button>
        <button
          className="w-16 h-16 bg-purple-600 rounded-full text-white text-2xl active:bg-purple-700 shadow-lg"
          onTouchStart={() => keysPressed.current.add('ArrowRight')}
          onTouchEnd={() => keysPressed.current.delete('ArrowRight')}
        >
          →
        </button>
      </div>

      {gameState !== 'playing' && (
        <button
          onClick={startGame}
          className="mt-6 md:hidden px-8 py-3 bg-gradient-to-r from-green-500 to-blue-500 text-white font-bold rounded-lg shadow-lg active:scale-95 transition-transform"
        >
          START GAME
        </button>
      )}

      <p className="mt-6 text-gray-500 text-sm hidden md:block">
        Use ← → or A/D to move • SPACE to shoot
      </p>
    </div>
  )
}

export default App