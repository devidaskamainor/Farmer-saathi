import { useState, useEffect, useRef } from 'react';
import {
  Satellite, Sprout, Droplets, Activity, ShieldCheck, MapPin,
  RefreshCw, Volume2, Square, ArrowRight, HelpCircle,
  TrendingUp, AlertTriangle, CheckCircle2, Waves, Eye, LocateFixed,
  Layers, ZoomIn, ZoomOut, Maximize2, Compass, Sun, CloudRain,
  ChevronRight, Sparkles, Crosshair, PieChart
} from 'lucide-react';
import { api, errorMessage } from '../services/api.js';
import useFarm from '../hooks/useFarm.js';
import PageTitle from '../components/common/PageTitle.jsx';
import Card from '../components/common/Card.jsx';
import LoadingBox from '../components/common/LoadingBox.jsx';
import ErrorNotice from '../components/common/ErrorNotice.jsx';
import { speakText, stopSpeaking } from '../services/voice.js';
import { words } from '../config/translations.js';

const popularCrops = [
  'Sugarcane', 'Cotton', 'Paddy / Rice', 'Tomato', 'Wheat',
  'Soybean', 'Chilli', 'Maize', 'Pulses / Gram', 'General Crops'
];

export default function SatellitePage() {
  const { farmer } = useFarm();
  const t = words[farmer?.preferredLanguage] || words.en;

  const [crop, setCrop] = useState(farmer?.currentCrops?.[0] || 'Sugarcane');
  const [locationInput, setLocationInput] = useState(
    [farmer?.village, farmer?.district, farmer?.state].filter(Boolean).join(', ') || 'Bidar, Karnataka, India'
  );
  const [coords, setCoords] = useState(null);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Satellite Imagery Viewer States
  const [activeLayer, setActiveLayer] = useState('true_color'); // 'true_color', 'false_color_cir', 'ndvi_overlay', 'ndwi_overlay', 'crop_classification'
  const [zoomLevel, setZoomLevel] = useState(16);
  const [highlightedCrop, setHighlightedCrop] = useState(null);
  const [selectedSection, setSelectedSection] = useState('sec-b');
  const [inspectedPoint, setInspectedPoint] = useState(null);
  const [showGuide, setShowGuide] = useState(false);

  // Voice narration state
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speakingText, setSpeakingText] = useState('');

  useEffect(() => {
    loadSatelliteData();
    return () => {
      stopSpeaking();
    };
  }, []);

  async function loadSatelliteData(overrideCoords) {
    setLoading(true);
    setError('');
    stopSpeaking();
    setIsSpeaking(false);
    setInspectedPoint(null);

    try {
      const activeCoords = overrideCoords || coords;
      const params = {
        crop,
        location: locationInput,
        farmSize: farmer?.farmSize || 5.0
      };

      if (activeCoords?.lat && activeCoords?.lon) {
        params.lat = activeCoords.lat;
        params.lon = activeCoords.lon;
      }

      const { data: responseData } = await api.get('/satellite', { params });
      setData(responseData);
      setSelectedSection('sec-b');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  function handleGpsDetection() {
    if (!navigator.geolocation) {
      window.alert('Geolocation is not supported by your browser.');
      return;
    }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        const detected = {
          lat: Number(pos.coords.latitude.toFixed(4)),
          lon: Number(pos.coords.longitude.toFixed(4))
        };
        setCoords(detected);
        setLocationInput(`GPS: ${detected.lat}°N, ${detected.lon}°E`);
        loadSatelliteData(detected);
      },
      err => {
        setLoading(false);
        window.alert(`GPS Detection failed: ${err.message}. Using saved location.`);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  }

  async function handleToggleSpeech() {
    if (isSpeaking) {
      stopSpeaking();
      setIsSpeaking(false);
      setSpeakingText('');
      return;
    }

    if (!data?.spokenSummary) return;

    setIsSpeaking(true);
    setSpeakingText(data.spokenSummary);

    const lang = farmer?.preferredLanguage || 'en';
    const result = await speakText(data.spokenSummary, lang);
    if (!result?.ok) {
      setIsSpeaking(false);
      setSpeakingText('');
    }
  }

  function handleMapClick(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 100);
    const y = Math.round(((e.clientY - rect.top) / rect.height) * 100);

    // Calculate simulated spot NDVI based on proximity to sections
    let spotNdvi = Number((data.indices.ndvi.value + ((x - 50) * 0.003) - ((y - 50) * 0.004)).toFixed(3));
    spotNdvi = Math.min(Math.max(spotNdvi, 0.15), 0.90);

    // Determine nearest crop based on parcel boundaries
    let spotCrop = data.location.crop;
    if (x > 60) spotCrop = data.regionalCrops?.[1]?.name || 'Soybean';
    if (y > 65) spotCrop = data.regionalCrops?.[2]?.name || 'Red Gram';

    setInspectedPoint({ x, y, ndvi: spotNdvi, crop: spotCrop });
  }

  return (
    <div className="satellite-page">
      <PageTitle
        eyebrow="SENTINEL-2 COPERNICUS"
        title="Satellite-Based Crop Monitoring"
        description="Live multi-spectral satellite imagery analyzing crop canopy vigor, moisture deficit, and regional crop distribution across your farmland."
      />

      {/* Control & Search Bar */}
      <Card className="satellite-controls-card">
        <div className="satellite-filter-bar">
          <div className="filter-item">
            <label className="field-label">Monitored Crop</label>
            <select
              value={crop}
              onChange={e => setCrop(e.target.value)}
              className="select-input"
            >
              {popularCrops.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="filter-item flex-grow">
            <label className="field-label">Farm Location or Village</label>
            <div className="input-with-button">
              <input
                type="text"
                value={locationInput}
                onChange={e => {
                  setLocationInput(e.target.value);
                  setCoords(null);
                }}
                placeholder="Enter village, district, or state"
                className="text-input"
              />
              <button
                type="button"
                onClick={handleGpsDetection}
                className="gps-btn"
                title="Detect GPS from device"
              >
                <LocateFixed size={16} />
                <span>GPS</span>
              </button>
            </div>
          </div>

          <div className="filter-actions">
            <button
              type="button"
              onClick={() => loadSatelliteData()}
              disabled={loading}
              className="primary-button filter-submit-btn"
            >
              <RefreshCw size={16} className={loading ? 'spin' : ''} />
              <span>Update Satellite Scene</span>
            </button>
          </div>
        </div>

        {/* Audio Narration Banner */}
        {data && (
          <div className="satellite-audio-strip">
            <button
              type="button"
              onClick={handleToggleSpeech}
              className={`voice-narrate-btn ${isSpeaking ? 'is-speaking' : ''}`}
            >
              {isSpeaking ? <Square size={16} /> : <Volume2 size={16} />}
              <span>{isSpeaking ? 'Stop Voice Report' : 'Listen to Satellite Report'}</span>
            </button>
            <div className="audio-meta">
              <span className="overpass-pill">
                <Satellite size={14} />
                <b>{data.meta.satellite}</b> ({data.meta.spatialResolution})
              </span>
              <span className="overpass-date">
                Last overpass: <b>{data.meta.lastOverpassDate}</b> • Cloud: <b>{data.meta.cloudCoverPct}%</b>
              </span>
            </div>
          </div>
        )}
      </Card>

      {error && <ErrorNotice error={error} onRetry={() => loadSatelliteData()} />}

      {loading ? (
        <LoadingBox label="Downloading Copernicus Sentinel-2 multi-spectral bands & generating farm scene…" />
      ) : data ? (
        <>
          {/* Active Alerts Banner if stress detected */}
          {data.alerts && data.alerts.length > 0 && (
            <div className="satellite-alerts-banner">
              <div className="alerts-badge">
                <AlertTriangle size={18} />
                <span>Satellite Action Alerts:</span>
              </div>
              <div className="alerts-list">
                {data.alerts.map(alert => (
                  <div key={alert.id} className={`alert-chip chip-${alert.severity}`}>
                    <b>{alert.section}:</b> {alert.message}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* MAIN SATELLITE IMAGE VIEWER */}
          <Card className="satellite-image-viewer-card">
            <div className="viewer-header">
              <div className="viewer-title-group">
                <span className="eyebrow">HIGH-RESOLUTION ORBITAL VIEW</span>
                <h2>Farmland Satellite Imagery</h2>
                <span className="viewer-coords">
                  <MapPin size={14} /> {data.location.name} ({data.location.latitude}°N, {data.location.longitude}°E) • {data.location.farmSizeAcres} Acres
                </span>
              </div>

              {/* Layer Selection Pills */}
              <div className="layer-mode-pills">
                <button
                  type="button"
                  onClick={() => setActiveLayer('true_color')}
                  className={`layer-pill ${activeLayer === 'true_color' ? 'active' : ''}`}
                  title="Natural visible RGB satellite imagery"
                >
                  <Eye size={14} />
                  <span>True Color RGB</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveLayer('false_color_cir')}
                  className={`layer-pill ${activeLayer === 'false_color_cir' ? 'active' : ''}`}
                  title="Color Infrared: NIR band highlights chlorophyll vitality"
                >
                  <Sparkles size={14} />
                  <span>False Color CIR</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveLayer('ndvi_overlay')}
                  className={`layer-pill ${activeLayer === 'ndvi_overlay' ? 'active' : ''}`}
                  title="Photosynthetic canopy vigor map"
                >
                  <Sprout size={14} />
                  <span>NDVI Vigor Map</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveLayer('ndwi_overlay')}
                  className={`layer-pill ${activeLayer === 'ndwi_overlay' ? 'active' : ''}`}
                  title="Canopy liquid water thickness"
                >
                  <Droplets size={14} />
                  <span>Moisture Heatmap</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveLayer('crop_classification')}
                  className={`layer-pill ${activeLayer === 'crop_classification' ? 'active' : ''}`}
                  title="Identifies most grown crops in this area"
                >
                  <Layers size={14} />
                  <span>Crop Distribution</span>
                </button>
              </div>
            </div>

            {/* Interactive Satellite Canvas Container */}
            <div
              className={`satellite-canvas-viewport layer-${activeLayer}`}
              onClick={handleMapClick}
              title="Click anywhere on the satellite image to inspect local crop health"
            >
              {/* Actual Satellite Tile Grid Background */}
              <div className="satellite-tile-layer">
                {data.tileMetadata?.surroundingTiles?.map((tile, i) => (
                  <img
                    key={i}
                    src={tile.url}
                    alt="Satellite Terrain Tile"
                    className="tile-img"
                    loading="lazy"
                    crossOrigin="anonymous"
                  />
                ))}
              </div>

              {/* Color Infrared Filter Effect */}
              {activeLayer === 'false_color_cir' && (
                <div className="false-color-infrared-filter" />
              )}

              {/* NDVI Heatmap Draped Overlay */}
              {activeLayer === 'ndvi_overlay' && (
                <div className="ndvi-heatmap-draped" />
              )}

              {/* NDWI Moisture Heatmap Overlay */}
              {activeLayer === 'ndwi_overlay' && (
                <div className="ndwi-moisture-draped" />
              )}

              {/* Farm Boundary Polygon (5-acre farmland outline) */}
              <svg className="farm-boundary-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
                <polygon
                  points="18,15 84,18 80,86 16,82"
                  className="farm-boundary-polygon"
                />
              </svg>

              {/* Crop Classification Parcels Overlay */}
              {activeLayer === 'crop_classification' && (
                <div className="crop-classification-overlay">
                  {data.farmParcels?.map(parcel => {
                    const isDimmed = highlightedCrop && highlightedCrop !== parcel.crop;
                    return (
                      <div
                        key={parcel.id}
                        className={`parcel-box parcel-${parcel.id} ${isDimmed ? 'dimmed' : ''}`}
                        style={{ borderColor: parcel.color }}
                      >
                        <span className="parcel-tag" style={{ backgroundColor: parcel.color }}>
                          {parcel.crop} ({parcel.areaAcres} ac)
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Section Inspection Pins (Section A, B, C, D) */}
              <div className="satellite-pins-overlay">
                {data.farmSections?.map(sec => {
                  const isSelected = selectedSection === sec.id;
                  return (
                    <button
                      key={sec.id}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedSection(sec.id);
                      }}
                      className={`section-pin-marker ${sec.statusCategory} ${isSelected ? 'is-selected' : ''}`}
                      style={{
                        left: sec.pinPosition.x,
                        top: sec.pinPosition.y,
                        borderColor: sec.color
                      }}
                    >
                      <span className="pin-dot" style={{ backgroundColor: sec.color }} />
                      <span className="pin-label">{sec.section}</span>
                      {sec.inspectionRequired && <span className="pin-pulse" />}
                    </button>
                  );
                })}
              </div>

              {/* User Inspected Spot Pin */}
              {inspectedPoint && (
                <div
                  className="inspected-spot-popup"
                  style={{ left: `${inspectedPoint.x}%`, top: `${inspectedPoint.y}%` }}
                >
                  <Crosshair size={18} className="crosshair-icon" />
                  <div className="spot-tooltip">
                    <strong>{inspectedPoint.crop}</strong>
                    <span>NDVI: <b>{inspectedPoint.ndvi}</b></span>
                    <span>Status: {inspectedPoint.ndvi > 0.6 ? 'Healthy' : inspectedPoint.ndvi > 0.4 ? 'Moderate' : 'Stressed'}</span>
                  </div>
                </div>
              )}

              {/* Viewer Compass & Attribution Badge */}
              <div className="viewer-bottom-bar">
                <div className="viewer-attribution">
                  <Compass size={14} />
                  <span>North-Oriented • Copernicus Sentinel-2 MSI Multi-Spectral • 10m Resolution</span>
                </div>
                <span className="click-hint">Click anywhere on the image to inspect point health</span>
              </div>
            </div>

            {/* Viewer Legend Bar */}
            <div className="viewer-legend-bar">
              <span className="legend-title">NDVI Color Scale:</span>
              <div className="ndvi-scale-bar">
                <span className="scale-stop red">&lt; 0.20 Sparse/Water</span>
                <span className="scale-stop yellow">0.20 - 0.40 Moderate</span>
                <span className="scale-stop light-green">0.40 - 0.60 Healthy</span>
                <span className="scale-stop dark-green">0.60 - 1.00 Dense Canopy</span>
              </div>
            </div>
          </Card>

          {/* TWO-COLUMN LAYOUT: REGIONAL CROPS & SECTION CLASSIFICATION */}
          <div className="satellite-insights-two-col">
            {/* COLUMN 1: MOST GROWN CROPS OVER THERE */}
            <Card className="regional-crops-card">
              <div className="card-head">
                <div>
                  <span className="eyebrow">REGIONAL CROP DISTRIBUTION</span>
                  <h3>Most Grown Crops in this Area</h3>
                  <p className="card-subtitle">
                    Satellite spectral classification of dominant crops cultivated across {data.location.name}.
                  </p>
                </div>
                <PieChart size={20} className="header-icon text-muted" />
              </div>

              <div className="regional-crops-list">
                {data.regionalCrops?.map(rc => {
                  const isHighlighted = highlightedCrop === rc.name;
                  return (
                    <div
                      key={rc.name}
                      className={`regional-crop-row ${isHighlighted ? 'row-highlighted' : ''}`}
                    >
                      <div className="crop-color-indicator" style={{ backgroundColor: rc.color }} />
                      <div className="crop-info-col">
                        <div className="crop-name-line">
                          <strong>{rc.name}</strong>
                          <span className="crop-share-badge">{rc.sharePct}% Area Share</span>
                        </div>
                        <div className="crop-sub-details">
                          <span>Season: <b>{rc.season}</b></span>
                          <span>Typical NDVI: <b>{rc.typicalNdvi}</b></span>
                          <span>Water Need: <b>{rc.waterNeed}</b></span>
                        </div>
                        <p className="crop-spectral-desc">{rc.spectralProfile}</p>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setHighlightedCrop(isHighlighted ? null : rc.name);
                          setActiveLayer('crop_classification');
                        }}
                        className={`highlight-crop-btn ${isHighlighted ? 'active' : ''}`}
                      >
                        {isHighlighted ? 'Highlighted' : 'Highlight on Map'}
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Mapped Farm Parcels Summary */}
              <div className="farm-parcels-summary">
                <span className="parcels-label">Your Farm Parcels (5.0 Acres):</span>
                <div className="parcels-badges">
                  {data.farmParcels?.map(p => (
                    <span key={p.id} className="parcel-chip" style={{ borderColor: p.color }}>
                      <span className="chip-dot" style={{ backgroundColor: p.color }} />
                      <b>{p.crop}</b>: {p.areaAcres} ac (NDVI {p.ndvi})
                    </span>
                  ))}
                </div>
              </div>
            </Card>

            {/* COLUMN 2: SECTION-BY-SECTION WORKFLOW (Example 5) */}
            <Card className="sections-workflow-card">
              <div className="card-head">
                <div>
                  <span className="eyebrow">SECTION-BY-SECTION ANALYSIS</span>
                  <h3>Farmland Inspection Sections</h3>
                  <p className="card-subtitle">
                    Targeted field inspection based on the latest Sentinel-2 observation.
                  </p>
                </div>
                <Crosshair size={20} className="header-icon text-muted" />
              </div>

              <div className="sections-table-wrapper">
                <table className="sections-table">
                  <thead>
                    <tr>
                      <th>Farm Section</th>
                      <th>Vegetation Condition</th>
                      <th>NDVI</th>
                      <th>Suggested Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.farmSections?.map(sec => {
                      const isSelected = selectedSection === sec.id;
                      return (
                        <tr
                          key={sec.id}
                          onClick={() => setSelectedSection(sec.id)}
                          className={`section-row ${isSelected ? 'row-selected' : ''}`}
                        >
                          <td>
                            <div className="section-cell-title">
                              <span className="sec-indicator" style={{ backgroundColor: sec.color }} />
                              <b>{sec.section}</b>
                            </div>
                            <span className="sec-sub">{sec.areaAcres} Acres</span>
                          </td>
                          <td>
                            <span className={`status-pill status-${sec.statusCategory}`}>
                              {sec.vegetationCondition}
                            </span>
                          </td>
                          <td>
                            <strong style={{ color: sec.color }}>{sec.ndviValue}</strong>
                          </td>
                          <td>
                            <div className="action-cell">
                              <p>{sec.suggestedAction}</p>
                              {sec.inspectionRequired && (
                                <span className="inspect-tag">
                                  <AlertTriangle size={12} /> Inspect Field
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Selected Section Spotlight */}
              {selectedSection && (() => {
                const activeSec = data.farmSections.find(s => s.id === selectedSection);
                if (!activeSec) return null;
                return (
                  <div className="section-spotlight-box" style={{ borderColor: activeSec.color }}>
                    <div className="spotlight-top">
                      <span className="spotlight-title">
                        <b>{activeSec.title} Focus</b>
                      </span>
                      <span className="spotlight-range">NDVI Range: {activeSec.ndviRange}</span>
                    </div>
                    <p className="spotlight-text">{activeSec.suggestedAction}</p>
                    <div className="spotlight-footer">
                      <span>NDWI Moisture Index: <b>{activeSec.ndwiValue}</b></span>
                      <span>Field Area: <b>{activeSec.areaAcres} Acres</b></span>
                    </div>
                  </div>
                );
              })()}
            </Card>
          </div>

          {/* WEATHER & SATELLITE CORRELATION PANEL */}
          <Card className="weather-correlation-card">
            <div className="card-head">
              <div>
                <span className="eyebrow">CLIMATE & SATELLITE CORRELATION</span>
                <h3>Weather Impact on Crop Growth</h3>
              </div>
              <Sun size={20} className="header-icon text-muted" />
            </div>

            <div className="weather-correlation-grid">
              <div className="weather-stat-box">
                <span className="stat-label">7-Day Rainfall</span>
                <strong className="stat-val">{data.weatherCorrelation.sevenDayRainfallMm} mm</strong>
                <span className="stat-sub">Recent Precipitation</span>
              </div>
              <div className="weather-stat-box">
                <span className="stat-label">Max Temperature</span>
                <strong className="stat-val">{data.weatherCorrelation.maxTemperature}</strong>
                <span className="stat-sub">Daytime Heat Index</span>
              </div>
              <div className="weather-stat-box">
                <span className="stat-label">Evapotranspiration</span>
                <strong className="stat-val">{data.weatherCorrelation.evapotranspirationDemand}</strong>
                <span className="stat-sub">Canopy Water Loss</span>
              </div>
              <div className="weather-stat-box">
                <span className="stat-label">Root Zone Moisture</span>
                <strong className="stat-val">{data.soilAndAtmosphere.rootZoneMoisturePct}%</strong>
                <span className="stat-sub">Microwave Radar Soil Probe</span>
              </div>
            </div>

            <div className="correlation-assessment-box">
              <span className="assessment-label">Meteorological Correlation Analysis:</span>
              <p>{data.weatherCorrelation.assessment}</p>
            </div>
          </Card>

          {/* 6-WEEK HISTORICAL SENTINEL-2 TIMELINE */}
          <Card className="trajectory-card">
            <div className="card-head">
              <div>
                <span className="eyebrow">6-WEEK TIMELINE</span>
                <h3>Sentinel-2 Historical Revisit Trajectory</h3>
              </div>
              <span className="satellite-tag">
                <Satellite size={14} /> 5-Day Revisit Cadence
              </span>
            </div>

            <div className="timeline-horizontal-scroll">
              <div className="timeline-steps">
                {data.timeSeries.map((pass, index) => {
                  const isLatest = index === data.timeSeries.length - 1;
                  return (
                    <div key={pass.date} className={`timeline-step ${isLatest ? 'latest-pass' : ''}`}>
                      <div className="pass-marker-dot" />
                      <div className="pass-date">{pass.date}</div>
                      <div className="pass-satellite">{pass.satellite}</div>
                      <div className="pass-ndvi-badge">
                        <span>NDVI:</span> <b>{pass.ndvi}</b>
                      </div>
                      <div className="pass-stage">{pass.stage}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>

          {/* ACTIONABLE AGRONOMIC RECOMMENDATIONS */}
          <div className="recommendations-container">
            <div className="section-heading">
              <div>
                <span className="eyebrow">ACTION PLAN</span>
                <h2>Field Inspection & Care Recommendations</h2>
              </div>
            </div>

            <div className="recommendations-cards-grid">
              {data.recommendations.map((rec, i) => {
                const isHigh = rec.priority === 'High';
                const isMedium = rec.priority === 'Medium';
                return (
                  <Card key={i} className={`advisory-card ${isHigh ? 'priority-high' : isMedium ? 'priority-medium' : ''}`}>
                    <div className="advisory-top">
                      <span className="advisory-category">
                        {rec.category === 'Irrigation' ? <Droplets size={16} /> : rec.category.includes('Scouting') ? <Crosshair size={16} /> : <Sprout size={16} />}
                        {rec.category}
                      </span>
                      <span className={`priority-pill priority-${rec.priority.toLowerCase()}`}>
                        {rec.priority} Priority
                      </span>
                    </div>
                    <h3 className="advisory-title">{rec.title}</h3>
                    <p className="advisory-details">{rec.details}</p>
                    <div className="advisory-action-footer">
                      <span className="action-tag">{rec.action}</span>
                      <span className="source-cite">Copernicus Sentinel-2 MSI</span>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* EDUCATIONAL GUIDE: UNDERSTANDING SATELLITE INDICES */}
          <Card className="educational-guide-card">
            <button
              type="button"
              onClick={() => setShowGuide(!showGuide)}
              className="guide-toggle-btn"
            >
              <div className="guide-title-left">
                <HelpCircle size={18} />
                <span>How Satellites Monitor Your Farmland (NDVI, Sentinel-2 & Earth Observation Explained)</span>
              </div>
              <ArrowRight size={16} className={`chevron-icon ${showGuide ? 'rotate-90' : ''}`} />
            </button>

            {showGuide && (
              <div className="guide-content-body">
                <div className="guide-entry">
                  <b>What is NDVI (Normalized Difference Vegetation Index)?</b>
                  <p>
                    Green leaves absorb red light for photosynthesis and reflect near-infrared (NIR) light back to the satellite.
                    Sentinel-2 measures this exact ratio: (NIR - Red) / (NIR + Red).
                    Healthy sugarcane, paddy, and cotton exhibit values between 0.60 and 0.85. Values below 0.40 flag stunted growth or moisture stress.
                  </p>
                </div>
                <div className="guide-entry">
                  <b>How Does Sentinel-2 Capture Farm Images?</b>
                  <p>
                    The European Space Agency (ESA) operates two identical satellites (Sentinel-2A and Sentinel-2B) orbiting at 786 km altitude.
                    Together they revisit every farm in India every 5 days, providing 13 multi-spectral bands at 10m to 20m ground resolution.
                  </p>
                </div>
                <div className="guide-entry">
                  <b>What is NDWI (Canopy Moisture Index)?</b>
                  <p>
                    Using Short-Wave Infrared (SWIR) bands, NDWI measures the liquid water thickness inside plant leaf cells.
                    When crops suffer moisture stress, SWIR reflectance surges, causing NDWI to plummet before visible leaf wilting occurs.
                  </p>
                </div>
                <div className="guide-entry">
                  <b>Important Note on Satellite Data:</b>
                  <p>
                    NDVI indicates greenness and density but does not identify the specific cause (e.g. fungus, stem borer, or lack of water).
                    Always inspect sections flagged by the satellite (such as Section B or Section C) directly on the ground before spraying or fertilizing.
                  </p>
                </div>
              </div>
            )}
          </Card>
        </>
      ) : null}
    </div>
  );
}
