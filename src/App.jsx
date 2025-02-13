import { useState, useEffect, useRef } from 'react'
import './App.css'

function App() {
  const [articles, setArticles] = useState([])
  const [selectedArticle, setSelectedArticle] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [displayLanguage, setDisplayLanguage] = useState('both')
  const [audioLanguage, setAudioLanguage] = useState('')
  const [showSentences, setShowSentences] = useState([])
  const [availableLanguages, setAvailableLanguages] = useState([])
  const [showConfigModal, setShowConfigModal] = useState(false)
  const [githubRepo, setGithubRepo] = useState('')

  const audioRef = useRef(null)
  const GITHUB_BRANCH = 'master'

  useEffect(() => {
    // 从 localStorage 获取配置
    const savedRepo = localStorage.getItem('githubRepo')
    if (savedRepo) {
      setGithubRepo(savedRepo)
    } else {
      setShowConfigModal(true)
    }
  }, [])

  useEffect(() => {
    if (githubRepo) {
      fetchArticles()
    }
  }, [githubRepo])

  const handleConfigSubmit = (repo) => {
    setGithubRepo(repo)
    localStorage.setItem('githubRepo', repo)
    setShowConfigModal(false)
    fetchArticles()
  }

  const fetchArticles = async () => {
    if (!githubRepo) return
    setLoading(true)
    setError('')
    try {
      const response = await fetch(`https://api.github.com/repos/${githubRepo}/contents/backend/articles?ref=${GITHUB_BRANCH}`)
      const data = await response.json()
      
      if (Array.isArray(data)) {
        const articlePromises = data.map(async (file) => {
          const articleResponse = await fetch(file.download_url)
          const articleData = await articleResponse.json()
          return {
            id: file.name.replace('.json', ''),
            ...articleData
          }
        })

        const articles = await Promise.all(articlePromises)
        const sortedArticles = articles.sort((a, b) => b.id.localeCompare(a.id))
        setArticles(sortedArticles)
        if (sortedArticles.length > 0) {
          handleArticleSelect(sortedArticles[0])
        }
      }
    } catch (err) {
      setError('获取文章列表失败: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleArticleSelect = (article) => {
    setSelectedArticle(article)
    setIsSidebarOpen(false)

    const languages = Object.keys(article.language_versions || {})
    setAvailableLanguages(languages)
    
    const defaultLang = languages.includes('en') ? 'en' : languages[0]
    setAudioLanguage(defaultLang)
    
    if (article && article.language_versions && article.language_versions[defaultLang]) {
      const sentences = article.language_versions[defaultLang].sentences || []
      const audioUrl = `https://raw.githubusercontent.com/${githubRepo}/${GITHUB_BRANCH}/backend/audio_files/${article.language_versions[defaultLang].audio_filename}`
      setSelectedArticle(prev => ({ ...prev, audioUrl }))
      handleDisplayLanguageChange('both', sentences)
    } else {
      setError('文章内容加载失败')
    }
  }

  useEffect(() => {
    if (selectedArticle?.audioUrl && audioRef.current) {
      audioRef.current.src = selectedArticle.audioUrl
      audioRef.current.load()
    }
  }, [selectedArticle])

  const handleDisplayLanguageChange = (lang, sentences = null) => {
    setDisplayLanguage(lang)
    const targetSentences = sentences || (selectedArticle && selectedArticle.language_versions && selectedArticle.language_versions[audioLanguage]?.sentences) || []
    if (!targetSentences) return

    let temp = []
    if (lang === 'both') {
      temp = targetSentences
    } else {
      temp = targetSentences.filter(
        (sentence) => sentence.language === lang || sentence.text === '\n'
      )
    }
    setShowSentences(temp)
  }

  return (
    <div className="app-container">
      <button
        className="sidebar-toggle"
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
      >
        ☰
      </button>

      <button
        className="config-button"
        onClick={() => setShowConfigModal(true)}
        title="配置仓库"
      >
        ⚙️
      </button>

      {showConfigModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>配置 GitHub 仓库</h3>
            <input
              type="text"
              defaultValue={githubRepo}
              placeholder="请输入 GitHub 仓库地址 (格式: 用户名/仓库名)"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleConfigSubmit(e.target.value)
                }
              }}
            />
            <div className="modal-buttons">
              <button onClick={() => handleConfigSubmit(document.querySelector('.modal-content input').value)}>
                确定
              </button>
              {githubRepo && (
                <button onClick={() => setShowConfigModal(false)}>
                  取消
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className={`sidebar ${isSidebarOpen ? 'open' : ''}`}>
        <h2> &nbsp; </h2>
        {loading ? (
          <div className="loading">加载中...</div>
        ) : error ? (
          <div className="error">{error}</div>
        ) : (
          <div className="article-list">
            {articles.map(article => (
              <div
                key={article.id}
                className={`article-item ${selectedArticle?.id === article.id ? 'selected' : ''}`}
                onClick={() => handleArticleSelect(article)}
              >
                {article.title || article.id}
              </div>
            ))}
          </div>
        )}
      </div>
      
      <div className="main-content">
        {selectedArticle ? (
          <div className="article-view">
            <div className="article-content">
              <h2>{selectedArticle.title}</h2>
              <div className="language-controls">
                <select
                  value={displayLanguage}
                  onChange={(e) => handleDisplayLanguageChange(e.target.value)}
                  className="language-selector"
                >
                  <option value="both">中英对照</option>
                  <option value="zh">仅中文</option>
                  <option value="en">仅英文</option>
                </select>
                <div className="audio-language-buttons">
                  {availableLanguages.map((lang) => (
                    <button
                      key={lang}
                      className={`audio-language-btn ${audioLanguage === lang ? 'active' : ''}`}
                      onClick={() => {
                        setAudioLanguage(lang)
                        if (selectedArticle) {
                          const newAudioUrl = `https://raw.githubusercontent.com/${githubRepo}/${GITHUB_BRANCH}/backend/audio_files/${selectedArticle.audio_filename.replace(/_(en|zh)_/, `_${lang}_`)}`
                          audioRef.current.src = newAudioUrl
                          audioRef.current.load()
                          audioRef.current.play()
                        }
                      }}
                    >
                      {lang === 'zh' ? '中' : 'EN'}
                    </button>
                  ))}
                </div>
              </div>
              {showSentences.map((sentence, index) => (
                sentence.text === '\n' ? (
                  <br key={index} />
                ) : (
                  <span
                    key={index}
                    className={`sentence ${currentTime >= sentence.start_time && currentTime <= sentence.end_time ? 'active' : ''}`}
                    onClick={() => {
                      if (audioRef.current) {
                        audioRef.current.currentTime = sentence.start_time;
                        audioRef.current.play();
                      }
                    }}
                    ref={el => {
                      if (el && currentTime >= sentence.start_time && currentTime <= sentence.end_time) {
                        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      }
                    }}
                  >
                    {sentence.text}{' '}
                  </span>
                )
              ))}
            </div>
            <div className="audio-player-bottom">
              <audio 
                ref={audioRef}
                controls
                src={selectedArticle.audioUrl}
                onTimeUpdate={(e) => setCurrentTime(e.target.currentTime)}
              >
                您的浏览器不支持音频播放
              </audio>
            </div>
          </div>
        ) : loading ? (
          <div className="loading">加载中...</div>
        ) : error ? (
          <div className="error">{error}</div>
        ) : null}
      </div>
    </div>
  )
}

export default App
