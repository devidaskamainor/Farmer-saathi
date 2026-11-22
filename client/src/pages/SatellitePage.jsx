import { useState, useEffect, useRef } from 'react';
import {
  Satellite, Sprout, Droplets, Activity, ShieldCheck, MapPin,
  RefreshCw, Volume2, Square, ArrowRight, HelpCircle,
  TrendingUp, AlertTriangle, CheckCircle2, Waves, Eye, LocateFixed
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
  'General Crops', 'Cotton', 'Paddy / Rice', 'Tomato', 'Wheat',
  'Sugarcane', 'Soybean', 'Chilli', 'Maize', 'Pulses / Gram'
];

export default function SatellitePage() {
  const { farmer } = useFarm();
  const t = words[farmer?.preferredLanguage] || words.en;

  const [crop, setCrop] = useState(farmer?.currentCrops?.[0] || 'General Crops');
  const [locationInput, setLocationInput] = useState(
    [farmer?.village, farmer?.district, farmer?.state].filter(Boolean).join(', ') || 'Karnataka, India'
  );
  const [coords, setCoords] = useState(null);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [activeZone, setActiveZone] = useState(null);
  const [heatmapMode, setHeatmapMode] = useState('ndvi'); // 'ndvi' or 'ndwi'
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

    try {
      const activeCoords = overrideCoords || coords;
      const params = {
        crop,
        location: locationInput,
        farmSize: farmer?.farmSize || 2.5
      };

      if (activeCoords?.lat && activeCoords?.lon) {
        params.lat = activeCoords.lat;
        params.lon = activeCoords.lon;
      }

      const { data: responseData } = await api.get('/satellite', { params });
      setData(responseData);
      // Select central zone by default
      const centerZone = responseData.fieldZoning?.zones?.find(z => z.id === 'B2') || responseData.fieldZoning?.zones?.[4];
      setActiveZone(centerZone || null);
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

  return (
    <div className="satellite-page">
      <PageTitle
        eyebrow="REMOTE SENSING"
        title="Satellite Crop Monitoring"
        description="Multi-spectral Sentinel-2 satellite analysis tracking photosynthetic biomass, water deficit, and canopy health across your farm plot."
      />

      {/* Control & Search Bar */}
      <Card className="satellite-controls-card">
        <div className="satellite-filter-bar">
          <div className="filter-item">
            <label className="field-label">Field Crop</label>
            <select
              value={crop}
              onChange={e => {
                setCrop(e.target.value);
              }}
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
              <span>Fetch Satellite Pass</span>
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
        <LoadingBox label="Acquiring Copernicus Sentinel-2 multi-spectral bands…" />
      ) : data ? (
        <>
          {/* Top 4 KPI Metrics */}
          <div className="satellite-kpi-grid">
            {/* NDVI Card */}
            <Card className="satellite-kpi-card">
              <div className="kpi-header">
                <div>
                  <span className="eyebrow">VEGETATION INDEX</span>
                  <h3>NDVI Vigor</h3>
                </div>
                <span className="status-badge" style={{ backgroundColor: `${data.indices.ndvi.color}22`, color: data.indices.ndvi.color, borderColor: data.indices.ndvi.color }}>
                  {data.indices.ndvi.rating}
                </span>
              </div>
              <div className="kpi-main-val">
                <span className="value-number">{data.indices.ndvi.value}</span>
                <span className="scale-range">/ 1.00</span>
              </div>
              <div className="gauge-track">
                <div
                  className="gauge-fill"
                  style={{
                    width: `${Math.min(Math.max(data.indices.ndvi.value * 100, 5), 100)}%`,
                    backgroundColor: data.indices.ndvi.color
                  }}
                />
              </div>
              <p className="kpi-explanation">{data.indices.ndvi.description}</p>
            </Card>

            {/* NDWI Card */}
            <Card className="satellite-kpi-card">
              <div className="kpi-header">
                <div>
                  <span className="eyebrow">CANOPY MOISTURE</span>
                  <h3>NDWI Hydration</h3>
                </div>
                <span className="status-badge" style={{ backgroundColor: `${data.indices.ndwi.color}22`, color: data.indices.ndwi.color, borderColor: data.indices.ndwi.color }}>
                  {data.indices.ndwi.rating}
                </span>
              </div>
              <div className="kpi-main-val">
                <span className="value-number">{data.indices.ndwi.value}</span>
                <span className="scale-range">[-0.5 to +0.5]</span>
              </div>
              <div className="gauge-track">
                <div
                  className="gauge-fill"
                  style={{
                    width: `${Math.min(Math.max((data.indices.ndwi.value + 0.2) * 125, 5), 100)}%`,
                    backgroundColor: data.indices.ndwi.color
                  }}
                />
              </div>
              <p className="kpi-explanation">{data.indices.ndwi.description}</p>
            </Card>

            {/* NDRE Card */}
            <Card className="satellite-kpi-card">
              <div className="kpi-header">
                <div>
                  <span className="eyebrow">RED-EDGE CHLOROPHYLL</span>
                  <h3>NDRE Nitrogen</h3>
                </div>
                <span className="status-badge" style={{ backgroundColor: `${data.indices.ndre.color}22`, color: data.indices.ndre.color, borderColor: data.indices.ndre.color }}>
                  {data.indices.ndre.rating}
                </span>
              </div>
              <div className="kpi-main-val">
                <span className="value-number">{data.indices.ndre.value}</span>
                <span className="scale-range">/ 0.60</span>
              </div>
              <div className="gauge-track">
                <div
                  className="gauge-fill"
                  style={{
                    width: `${Math.min(Math.max(data.indices.ndre.value * 166, 5), 100)}%`,
                    backgroundColor: data.indices.ndre.color
                  }}
                />
              </div>
              <p className="kpi-explanation">{data.indices.ndre.description}</p>
            </Card>

            {/* Soil Moisture Radar */}
            <Card className="satellite-kpi-card">
              <div className="kpi-header">
                <div>
                  <span className="eyebrow">RADAR SOIL SENSOR</span>
                  <h3>Root Zone Moisture</h3>
                </div>
                <span className="status-badge status-badge-info">
                  {data.soilAndAtmosphere.rootZoneMoisturePct > 28 ? 'Sufficient' : 'Deficit'}
                </span>
              </div>
              <div className="kpi-main-val">
                <span className="value-number">{data.soilAndAtmosphere.rootZoneMoisturePct}%</span>
                <span className="scale-range">Volumetric</span>
              </div>
              <div className="soil-meta-pills">
                <span>Surface (0-5cm): <b>{data.soilAndAtmosphere.surfaceMoisturePct}%</b></span>
                <span>Evaporation: <b>{data.soilAndAtmosphere.dailyEvapotranspirationMm} mm/d</b></span>
              </div>
              <p className="kpi-explanation">Derived from land surface microwave moisture and solar irradiance measurements.</p>
            </Card>
          </div>

          {/* Spatial Field Heatmap & Zone Inspector */}
          <div className="satellite-spatial-section">
            <Card className="heatmap-card">
              <div className="heatmap-header">
                <div>
                  <span className="eyebrow">SPATIAL FIELD GRID (3x3 ZONES)</span>
                  <h3>Plot Micro-Variation Heatmap</h3>
                  <p className="heatmap-subtitle">Click any zone below to inspect local crop vigor and targeted irrigation advice.</p>
                </div>
                <div className="heatmap-mode-toggle">
                  <button
                    type="button"
                    onClick={() => setHeatmapMode('ndvi')}
                    className={`toggle-tab ${heatmapMode === 'ndvi' ? 'active' : ''}`}
                  >
                    NDVI Vigor
                  </button>
                  <button
                    type="button"
                    onClick={() => setHeatmapMode('ndwi')}
                    className={`toggle-tab ${heatmapMode === 'ndwi' ? 'active' : ''}`}
                  >
                    Canopy Moisture
                  </button>
                </div>
              </div>

              {/* 3x3 Interactive Grid */}
              <div className="field-grid-matrix">
                {data.fieldZoning.zones.map(zone => {
                  const isSelected = activeZone?.id === zone.id;
                  const displayValue = heatmapMode === 'ndvi' ? zone.ndvi : zone.ndwi;
                  const color = zone.color;

                  return (
                    <button
                      key={zone.id}
                      type="button"
                      onClick={() => setActiveZone(zone)}
                      className={`grid-cell ${isSelected ? 'cell-selected' : ''}`}
                      style={{
                        backgroundColor: `${color}18`,
                        borderColor: isSelected ? color : `${color}44`
                      }}
                    >
                      <div className="cell-top">
                        <span className="cell-id">{zone.id}</span>
                        <span className="cell-badge" style={{ backgroundColor: color }}>
                          {heatmapMode === 'ndvi' ? zone.status : zone.moistureLabel}
                        </span>
                      </div>
                      <div className="cell-center">
                        <span className="cell-name">{zone.name}</span>
                        <strong className="cell-val" style={{ color }}>{displayValue}</strong>
                      </div>
                      <div className="cell-bottom">
                        <span>Moisture: <b>{zone.soilMoisturePct}%</b></span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Field Distribution Bar */}
              <div className="field-distribution-bar">
                <span className="dist-label">Plot Health Distribution:</span>
                <div className="dist-segments">
                  <span className="segment optimal" style={{ width: `${data.fieldZoning.distribution.optimalPct}%` }} title="Optimal Vigor">
                    {data.fieldZoning.distribution.optimalPct > 10 ? `${data.fieldZoning.distribution.optimalPct}% Optimal` : ''}
                  </span>
                  <span className="segment healthy" style={{ width: `${data.fieldZoning.distribution.healthyPct}%` }} title="Healthy Canopy">
                    {data.fieldZoning.distribution.healthyPct > 10 ? `${data.fieldZoning.distribution.healthyPct}% Healthy` : ''}
                  </span>
                  <span className="segment moderate" style={{ width: `${data.fieldZoning.distribution.moderatePct}%` }} title="Moderate Growth">
                    {data.fieldZoning.distribution.moderatePct > 10 ? `${data.fieldZoning.distribution.moderatePct}% Moderate` : ''}
                  </span>
                  <span className="segment stressed" style={{ width: `${data.fieldZoning.distribution.stressedPct}%` }} title="Moisture Stress">
                    {data.fieldZoning.distribution.stressedPct > 10 ? `${data.fieldZoning.distribution.stressedPct}% Stress` : ''}
                  </span>
                </div>
              </div>
            </Card>

            {/* Zone Diagnostic Detail Drawer */}
            <Card className="zone-inspector-card">
              <div className="card-head">
                <div>
                  <span className="eyebrow">ZONE DIAGNOSTIC</span>
                  <h3>{activeZone ? activeZone.name : 'Select a Zone'}</h3>
                </div>
                {activeZone && (
                  <span className="zone-id-pill" style={{ backgroundColor: activeZone.color }}>
                    {activeZone.id}
                  </span>
                )}
              </div>

              {activeZone ? (
                <div className="zone-details-body">
                  <div className="zone-metric-rows">
                    <div className="zone-metric-row">
                      <span>Vegetation Vigor (NDVI):</span>
                      <b style={{ color: activeZone.color }}>{activeZone.ndvi} ({activeZone.statusLabel})</b>
                    </div>
                    <div className="zone-metric-row">
                      <span>Canopy Water Index (NDWI):</span>
                      <b>{activeZone.ndwi} ({activeZone.moistureLabel})</b>
                    </div>
                    <div className="zone-metric-row">
                      <span>Estimated Soil Moisture:</span>
                      <b>{activeZone.soilMoisturePct}%</b>
                    </div>
                    <div className="zone-metric-row">
                      <span>Estimated Sector Area:</span>
                      <b>{activeZone.areaAcres} Acres</b>
                    </div>
                  </div>

                  <div className="zone-observation-box">
                    <span className="obs-label">Satellite Observation & Guidance:</span>
                    <p>{activeZone.observation}</p>
                  </div>
                </div>
              ) : (
                <p className="empty-subtext">Click any zone in the 3x3 grid to inspect sector analytics.</p>
              )}
            </Card>
          </div>

          {/* Historical Sentinel-2 Trajectory Timeline */}
          <Card className="trajectory-card">
            <div className="card-head">
              <div>
                <span className="eyebrow">6-WEEK TIMELINE</span>
                <h3>Sentinel-2 Historical Overpasses</h3>
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

          {/* Actionable Agronomic Recommendations */}
          <div className="recommendations-container">
            <div className="section-heading">
              <div>
                <span className="eyebrow">ACTION PLAN</span>
                <h2>Satellite Agronomic Advisories</h2>
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
                        {rec.category === 'Irrigation' ? <Droplets size={16} /> : rec.category.includes('Nutrient') ? <Sprout size={16} /> : <AlertTriangle size={16} />}
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

          {/* Educational Accordion: Understanding Satellite Indices */}
          <Card className="educational-guide-card">
            <button
              type="button"
              onClick={() => setShowGuide(!showGuide)}
              className="guide-toggle-btn"
            >
              <div className="guide-title-left">
                <HelpCircle size={18} />
                <span>How Satellites Monitor Your Crops (NDVI, NDWI & NDRE Explained)</span>
              </div>
              <ArrowRight size={16} className={`chevron-icon ${showGuide ? 'rotate-90' : ''}`} />
            </button>

            {showGuide && (
              <div className="guide-content-body">
                <div className="guide-entry">
                  <b>NDVI (Normalized Difference Vegetation Index)</b>
                  <p>
                    Healthy green leaves absorb red light for photosynthesis and reflect near-infrared (NIR) light.
                    Sentinel-2 measures this ratio. Values between 0.65 and 0.85 indicate vigorous biomass growth, while values below 0.40 flag sparse or stressed canopy.
                  </p>
                </div>
                <div className="guide-entry">
                  <b>NDWI (Normalized Difference Water Index)</b>
                  <p>
                    Uses short-wave infrared (SWIR) light to measure the internal liquid water thickness inside plant leaf cells.
                    When leaves experience water stress, SWIR reflectance surges, causing NDWI to decline before visible wilting occurs.
                  </p>
                </div>
                <div className="guide-entry">
                  <b>NDRE (Red-Edge Chlorophyll Index)</b>
                  <p>
                    Sensitive to chlorophyll absorption at the transition edge between red and infrared spectrum (705-740nm).
                    Ideal for dense crops like sugarcane, cotton, and maize where NDVI can saturate. Helps detect nitrogen deficiencies early.
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
