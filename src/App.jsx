import { useState, useEffect, useRef } from "react";
import "./App.css";

function App() {
  const [articles, setArticles] = useState([]);
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [displayLanguage, setDisplayLanguage] = useState("both");
  const [showSentences, setShowSentences] = useState([]);
  // const [availableLanguages, setAvailableLanguages] = useState([]);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [githubRepo, setGithubRepo] = useState("");
  const [playMode, setPlayMode] = useState(() => {
    // 从localStorage读取上次保存的播放模式，默认为"off"
    return localStorage.getItem("playMode") || "off";
  }); // "single" 当前文章循环, "list" 列表循环, "off" 关闭循环
  const [isFirstLoad, setIsFirstLoad] = useState(true);
  const [isAutoPlayTriggered, setIsAutoPlayTriggered] = useState(false);

  const audioRef = useRef(null);
  const GITHUB_BRANCH = "master";

  useEffect(() => {
    // 从 localStorage 获取配置
    const savedRepo = localStorage.getItem("githubRepo");
    if (savedRepo) {
      setGithubRepo(savedRepo);
    } else {
      setShowConfigModal(true);
    }
  }, []);

  useEffect(() => {
    if (githubRepo) {
      fetchArticles();
    }
  }, [githubRepo]);

  const handleConfigSubmit = (repo) => {
    setGithubRepo(repo);
    localStorage.setItem("githubRepo", repo);
    setShowConfigModal(false);
    fetchArticles();
  };

  const fetchArticles = async () => {
    if (!githubRepo) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(
        `https://api.github.com/repos/${githubRepo}/contents/articles?ref=${GITHUB_BRANCH}`
      );
      const data = await response.json();

      if (Array.isArray(data)) {
        const articlePromises = data.map(async (file) => {
          const articleResponse = await fetch(file.download_url);
          const articleData = await articleResponse.json();
          return {
            id: file.name.replace(".json", ""),
            ...articleData,
          };
        });

        const articles = await Promise.all(articlePromises);
        const sortedArticles = articles.sort((a, b) =>
          b.id.localeCompare(a.id)
        );
        setArticles(sortedArticles);
        if (sortedArticles.length > 0) {
          // 尝试从缓存中读取上次打开的文章
          const lastSelectedArticleId = localStorage.getItem('lastSelectedArticleId');
          let articleToSelect = sortedArticles[0]; // 默认选择第一篇
          
          if (lastSelectedArticleId) {
            const cachedArticle = sortedArticles.find(article => article.id === lastSelectedArticleId);
            if (cachedArticle) {
              articleToSelect = cachedArticle;
            }
          }
          
          handleArticleSelect(articleToSelect, true);
        }
      }
    } catch (err) {
      setError("获取文章列表失败: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleArticleSelect = (article, isAutoPlayTriggered = false) => {
    setSelectedArticle(article);
    setIsSidebarOpen(false);
    
    // 将当前选择的文章ID保存到缓存中
    localStorage.setItem('lastSelectedArticleId', article.id);

    const languages = Object.keys(article.language_versions || {});
    // setAvailableLanguages(languages);

    const defaultLang = languages.includes("en") ? "en" : languages[0];
    
    if (article?.language_versions?.[defaultLang]) {
      const sentences = article.language_versions[defaultLang].sentences || [];
      const audioUrl = `https://raw.githubusercontent.com/${githubRepo}/${GITHUB_BRANCH}/audio_files/${article.language_versions[defaultLang].audio_filename}`;
      setSelectedArticle((prev) => ({ ...prev, audioUrl }));
      handleDisplayLanguageChange("both", sentences);
      
      // 只有在连续播放触发时才设置为false来启动自动播放，其他情况都保持为true
      setIsFirstLoad(!isAutoPlayTriggered);
    } else {
      setError("文章内容加载失败");
    }
  };

  useEffect(() => {
    if (selectedArticle?.audioUrl && audioRef.current) {
      audioRef.current.src = selectedArticle.audioUrl;
      audioRef.current.load();
      // 只有在自动播放模式下且不是首次加载时才自动播放
      if (!isFirstLoad && isAutoPlayTriggered) {
        //延迟 2 秒
        setTimeout(() => {
          audioRef.current.play();
        }, 2000);
      } else if (isFirstLoad) {
        setIsFirstLoad(false);
      }
    }
  }, [selectedArticle, isFirstLoad, isAutoPlayTriggered]);

  // 添加音频结束事件处理
  useEffect(() => {
    const handleAudioEnd = () => {
      if (playMode === "single") {
        // 当前文章循环播放
        audioRef.current.currentTime = 0;
        // 延迟 2 秒后再播放
        setTimeout(() => {
          audioRef.current.play();
        }, 2000);
      } else if (playMode === "list" && articles.length > 0) {
        // 列表循环播放
        const currentIndex = articles.findIndex(article => article.id === selectedArticle.id);
        const nextIndex = (currentIndex + 1) % articles.length;
        setIsAutoPlayTriggered(true);
        handleArticleSelect(articles[nextIndex], true);
      }
      // playMode === "off" 时不做任何处理，音频自然结束
    };

    if (audioRef.current) {
      audioRef.current.addEventListener('ended', handleAudioEnd);
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.removeEventListener('ended', handleAudioEnd);
      }
    };
  }, [playMode, articles, selectedArticle]);

  // 添加键盘事件处理函数
  useEffect(() => {
    const handleKeyPress = (e) => {
      // 如果正在输入文本（比如在配置模态框中），则不处理空格键
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
      }
      
      // 当按下空格键且有选中的文章时
      if (e.code === 'Space' && selectedArticle && audioRef.current) {
        e.preventDefault(); // 阻止页面滚动
        if (audioRef.current.paused) {
          audioRef.current.play();
        } else {
          audioRef.current.pause();
        }
      }
    };

    // 添加事件监听
    window.addEventListener('keydown', handleKeyPress);

    // 清理函数
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, [selectedArticle]); // 依赖项包含 selectedArticle

  const handleDisplayLanguageChange = (lang, sentences = null) => {
    setDisplayLanguage(lang);
    let targetSentences = sentences;
    
    // 如果没有传入sentences，尝试从当前选中的文章中获取
    if (!targetSentences && selectedArticle?.language_versions) {
      const languages = Object.keys(selectedArticle.language_versions);
      const defaultLang = languages.includes("en") ? "en" : languages[0];
      targetSentences = selectedArticle.language_versions[defaultLang]?.sentences || [];
    }
    
    if (!targetSentences || !targetSentences.length) return;

    let temp = [];
    if (lang === "both") {
      // 显示所有内容（中英对照）
      temp = targetSentences;
    } else {
      // 只显示指定语言的内容和换行符
      temp = targetSentences.filter(
        (sentence) => sentence.language === lang || sentence.text === "\n"
      );
    }
    setShowSentences(temp);
  };

  return (
    <div className="app-container">
      {isSidebarOpen && (
        <div
          className={`sidebar-overlay ${isSidebarOpen ? 'show' : ''}`}
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
      <div className="top-toolbar">
        <div className="toolbar-right">
          <button
            className="toolbar-button"
            onClick={() => {
              let newLang;
              if (displayLanguage === "both") {
                newLang = "zh";
              } else if (displayLanguage === "zh") {
                newLang = "en";
              } else {
                newLang = "both";
              }
              handleDisplayLanguageChange(newLang);
            }}
            title={
              displayLanguage === "both" 
                ? "中英对照（点击切换到仅中文）" 
                : displayLanguage === "zh" 
                  ? "仅中文（点击切换到仅英文）" 
                  : "仅英文（点击切换到中英对照）"
            }
          >
            {displayLanguage === "both" ? "🔤" : displayLanguage === "zh" ? "🇨🇳" : "🇺🇸"}
          </button>
       
          <button
            className="toolbar-button"
            onClick={() => {
              let newMode;
              if (playMode === "off") {
                newMode = "single";
              } else if (playMode === "single") {
                newMode = "list";
              } else {
                newMode = "off";
              }
              setPlayMode(newMode);
              localStorage.setItem("playMode", newMode);
            }}
            title={
              playMode === "off" 
                ? "关闭循环播放（点击开启当前文章循环）" 
                : playMode === "single" 
                  ? "当前文章循环播放（点击切换到列表循环）" 
                  : "列表循环播放（点击关闭循环播放）"
            }
          >
            {playMode === "off" ? "🐻" : playMode === "single" ? "🔂" : "🔁"}
          </button>
          <button
            className="toolbar-button"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            title="文章列表"
          >
            ☰
          </button>
        </div>
      </div>

      {showConfigModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>配置 GitHub 仓库</h3>
            <input
              type="text"
              defaultValue={githubRepo}
              placeholder="请输入 GitHub 仓库地址 (格式: 用户名/仓库名)"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleConfigSubmit(e.target.value);
                }
              }}
            />
            <div className="modal-buttons">
              <button
                onClick={() =>
                  handleConfigSubmit(
                    document.querySelector(".modal-content input").value
                  )
                }
              >
                确定
              </button>
              {githubRepo && (
                <button onClick={() => setShowConfigModal(false)}>取消</button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className={`sidebar ${isSidebarOpen ? "open" : ""}`}>
        <div className="toolbar-left">
          <button
            className="toolbar-button"
            onClick={() => setShowConfigModal(true)}
            title="配置仓库"
          >
            ⚙️
          </button>
        </div>
        
        {loading ? (
          <div className="loading">加载中...</div>
        ) : error ? (
          <div className="error">{error}</div>
        ) : (
          <div className="article-list">
            {articles.map((article) => (
              <div
                key={article.id}
                className={`article-item ${
                  selectedArticle?.id === article.id ? "selected" : ""
                }`}
                onClick={() => handleArticleSelect(article)}
              >
                {article.title || article.id}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="main-content" onClick={() => isSidebarOpen && setIsSidebarOpen(false)}>
        {selectedArticle ? (
          <div className="article-view">
            <div className="article-content">
              <h2>{selectedArticle.title}</h2>

              {showSentences.map((sentence, index) =>
                sentence.text === "\n" ? (
                  <br key={index} />
                ) : (
                  <span
                    key={index}
                    className={`sentence ${currentTime >= sentence.start_time && currentTime <= sentence.end_time ? "active" : ""}`}
                    onClick={(e) => {
                      console.log(e);
                      if (isSidebarOpen) {
                        setIsSidebarOpen(false);
                        return;
                      }
                      if (audioRef.current) {
                        audioRef.current.currentTime = sentence.start_time;
                        audioRef.current.play();
                      }
                    }}
                    ref={(el) => {
                      if (el && currentTime >= sentence.start_time && currentTime <= sentence.end_time) {
                        el.scrollIntoView({ behavior: "smooth", block: "center" });
                      }
                    }}
                  >
                    {sentence.text}{" "}
                  </span>
                )
              )}
            </div>
          </div>
        ) : loading ? (
          <div className="loading">加载中...</div>
        ) : error ? (
          <div className="error">{error}</div>
        ) : null}
      </div>
      {selectedArticle ? (
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
      ) : null}
    </div>
  );
}

export default App;
