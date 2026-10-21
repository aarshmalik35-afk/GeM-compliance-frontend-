import { useState } from "react";
import "./App.css";

const API_URL = import.meta.env.VITE_API_URL;

function App() {
  const [activeTab, setActiveTab] = useState("dashboard");

  // =========================
  // BACKEND STATUS
  // =========================

  const [backendStatus, setBackendStatus] = useState("Unknown");
  const [backendMessage, setBackendMessage] = useState("");

  // =========================
  // COMPLIANCE FORM
  // =========================

  const [bidderName, setBidderName] = useState("");
  const [gstin, setGstin] = useState("");
  const [pan, setPan] = useState("");
  const [udyamNumber, setUdyamNumber] = useState("");
  const [epfoCode, setEpfoCode] = useState("");
  const [nsicNumber, setNsicNumber] = useState("");

  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // =========================
  // TENDER STATE
  // =========================

  const [tenderFile, setTenderFile] = useState(null);
  const [tenderResult, setTenderResult] = useState(null);
  const [tenderLoading, setTenderLoading] = useState(false);
  const [tenderError, setTenderError] = useState("");
  const [tenderSaved, setTenderSaved] = useState(false);

  // =========================
  // BACKEND HEALTH CHECK
  // =========================

  const checkHealth = async () => {
    console.log("API URL:", API_URL);

    setBackendStatus("Testing...");
    setBackendMessage("");

    if (!API_URL) {
      setBackendStatus("Disconnected");
      setBackendMessage("VITE_API_URL is missing.");
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/health`);

      console.log("Health response:", response);

      const text = await response.text();

      console.log("Health response body:", text);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${text}`);
      }

      setBackendStatus("Connected");
      setBackendMessage(text);
    } catch (err) {
      console.error("Backend connection failed:", err);

      setBackendStatus("Disconnected");
      setBackendMessage(err.message);
    }
  };

  // =========================
  // BACKEND STATUS CLASS
  // =========================

  const getBackendStatusClass = () => {
    if (backendStatus === "Connected") {
      return "status-connected";
    }

    if (backendStatus === "Disconnected") {
      return "status-disconnected";
    }

    if (backendStatus === "Testing...") {
      return "status-warning";
    }

    return "status-unknown";
  };

  // =========================
  // COMPLIANCE CHECK
  // =========================

  const verifyCompliance = async () => {
    setLoading(true);
    setError("");
    setResult(null);

    if (!API_URL) {
      setError("VITE_API_URL is not configured.");
      setLoading(false);
      return;
    }

    if (!bidderName.trim()) {
      setError("Bidder / Company Name is required.");
      setLoading(false);
      return;
    }

    try {
      const formData = new FormData();

      formData.append("bidder_name", bidderName);

      if (gstin.trim()) {
        formData.append("gstin", gstin);
      }

      if (pan.trim()) {
        formData.append("pan", pan);
      }

      if (udyamNumber.trim()) {
        formData.append("udyam_number", udyamNumber);
      }

      if (epfoCode.trim()) {
        formData.append("epfo_code", epfoCode);
      }

      if (nsicNumber.trim()) {
        formData.append("nsic_number", nsicNumber);
      }

      console.log(
        "Sending compliance request to:",
        `${API_URL}/api/verify-compliance`
      );

      const response = await fetch(
        `${API_URL}/api/verify-compliance`,
        {
          method: "POST",
          body: formData,
        }
      );

      const text = await response.text();

      console.log("Compliance response:", text);

      let data;

      try {
        data = JSON.parse(text);
      } catch {
        data = { detail: text };
      }

      if (!response.ok) {
        throw new Error(
          data.detail ||
            `Request failed with HTTP ${response.status}`
        );
      }

      setResult(data);
      setBackendStatus("Connected");
    } catch (err) {
      console.error("Compliance error:", err);

      setError(
        err.message || "Unable to connect to backend."
      );

      setBackendStatus("Disconnected");
    } finally {
      setLoading(false);
    }
  };

  // =========================
  // TENDER FILE SELECTION
  // =========================

  const handleTenderFileChange = (event) => {
    const file = event.target.files?.[0];

    setTenderError("");
    setTenderResult(null);
    setTenderSaved(false);

    if (!file) {
      setTenderFile(null);
      return;
    }

    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setTenderFile(null);
      setTenderError("Please select a PDF tender document.");
      return;
    }

    setTenderFile(file);
  };

  // =========================
  // ANALYZE TENDER
  // =========================

  const analyzeTender = async () => {
    setTenderError("");
    setTenderResult(null);
    setTenderSaved(false);

    if (!API_URL) {
      setTenderError("VITE_API_URL is not configured.");
      return;
    }

    if (!tenderFile) {
      setTenderError("Please choose a tender PDF first.");
      return;
    }

    setTenderLoading(true);

    try {
      const formData = new FormData();

      // IMPORTANT:
      // This must match the FastAPI parameter:
      // tender_doc
      formData.append("tender_doc", tenderFile);

      console.log(
        "Sending tender to:",
        `${API_URL}/api/analyze-tender`
      );

      console.log("Tender file:", tenderFile.name);

      const response = await fetch(
        `${API_URL}/api/analyze-tender`,
        {
          method: "POST",
          body: formData,
        }
      );

      const text = await response.text();

      console.log("Tender response:", text);

      let data;

      try {
        data = JSON.parse(text);
      } catch {
        data = {
          detail: text,
        };
      }

      if (!response.ok) {
        throw new Error(
          data.detail ||
            `Tender analysis failed with HTTP ${response.status}`
        );
      }

      setTenderResult(data);
      setBackendStatus("Connected");
    } catch (err) {
      console.error("Tender analysis error:", err);

      setTenderError(
        err.message ||
          "Unable to analyze the tender document."
      );

      setBackendStatus("Disconnected");
    } finally {
      setTenderLoading(false);
    }
  };

  // =========================
  // SAVE TENDER
  // =========================

  const saveTender = () => {
    if (!tenderResult) {
      setTenderError(
        "Analyze the tender before saving it."
      );
      return;
    }

    try {
      const existingTenders = JSON.parse(
        localStorage.getItem("gem_saved_tenders") || "[]"
      );

      const savedTender = {
        id: Date.now(),
        file_name: tenderFile?.name || "Tender Document",
        saved_at: new Date().toISOString(),
        analysis: tenderResult,
      };

      existingTenders.push(savedTender);

      localStorage.setItem(
        "gem_saved_tenders",
        JSON.stringify(existingTenders)
      );

      setTenderSaved(true);
      setTenderError("");
    } catch (err) {
      console.error("Save tender error:", err);

      setTenderError(
        "Tender was analyzed but could not be saved."
      );
    }
  };

  // =========================
  // RESULT STATUS
  // =========================

  const getStatusClass = (status) => {
    if (
      status === "ELIGIBLE" ||
      status === "PASS"
    ) {
      return "status-pass";
    }

    if (
      status === "NOT_ELIGIBLE" ||
      status === "FAIL"
    ) {
      return "status-fail";
    }

    return "status-warning";
  };

  // =========================
  // RENDER
  // =========================

  return (
    <div className="app">

      {/* =========================
          HEADER
      ========================= */}

      <header className="header">

        <div className="brand">

          <div className="brand-icon">
            ✓
          </div>

          <div>
            <h1>
              GeM Compliance Intelligence
            </h1>

            <p>
              AI-Powered Government Tender Compliance
            </p>
          </div>

        </div>

        <div className="header-actions">

          <span
            className={`backend-status ${getBackendStatusClass()}`}
          >
            <span className="status-dot"></span>

            Backend {backendStatus}
          </span>

          <button
            className="health-button"
            onClick={checkHealth}
          >
            Test Backend
          </button>

        </div>

      </header>

      {/* =========================
          HEALTH MESSAGE
      ========================= */}

      {backendMessage && (
        <div className="health-message">
          <strong>Backend response:</strong>
          <span>{backendMessage}</span>
        </div>
      )}

      {/* =========================
          NAVIGATION
      ========================= */}

      <nav className="navigation">

        <button
          className={
            activeTab === "dashboard"
              ? "nav-active"
              : ""
          }
          onClick={() =>
            setActiveTab("dashboard")
          }
        >
          Dashboard
        </button>

        <button
          className={
            activeTab === "compliance"
              ? "nav-active"
              : ""
          }
          onClick={() =>
            setActiveTab("compliance")
          }
        >
          Compliance Check
        </button>

        <button
          className={
            activeTab === "tender"
              ? "nav-active"
              : ""
          }
          onClick={() =>
            setActiveTab("tender")
          }
        >
          Tender Analysis
        </button>

      </nav>

      {/* =========================
          MAIN
      ========================= */}

      <main className="main">

        {/* =====================================================
            DASHBOARD
        ===================================================== */}

        {activeTab === "dashboard" && (
          <>
            <section className="hero">

              <div>

                <span className="eyebrow">
                  GOVERNMENT PROCUREMENT
                </span>

                <h2>
                  Tender Compliance,
                  <br />
                  <span>
                    simplified with AI.
                  </span>
                </h2>

                <p>
                  Verify bidder credentials,
                  analyze GeM tenders and identify
                  compliance risks in seconds.
                </p>

                <button
                  className="primary-button"
                  onClick={() =>
                    setActiveTab("compliance")
                  }
                >
                  Start Compliance Check →
                </button>

              </div>

              <div className="hero-card">

                <div className="hero-card-icon">
                  AI
                </div>

                <h3>
                  AI Compliance Engine
                </h3>

                <p>
                  Automated verification across
                  government registration requirements.
                </p>

                <div className="mini-stat">
                  <strong>6+</strong>
                  <span>
                    Compliance checks
                  </span>
                </div>

                <div className="mini-stat">
                  <strong>AI</strong>
                  <span>
                    Powered analysis
                  </span>
                </div>

                <div className="mini-stat">
                  <strong>24/7</strong>
                  <span>
                    Availability
                  </span>
                </div>

              </div>

            </section>

            <section className="feature-grid">

              <div className="feature-card">

                <div className="feature-icon blue">
                  GST
                </div>

                <h3>
                  Registration Verification
                </h3>

                <p>
                  Verify GST, PAN, UDYAM,
                  EPFO and NSIC registration
                  details.
                </p>

              </div>

              <div className="feature-card">

                <div className="feature-icon green">
                  AI
                </div>

                <h3>
                  AI Document Extraction
                </h3>

                <p>
                  Extract important information
                  from uploaded government documents.
                </p>

              </div>

              <div className="feature-card">

                <div className="feature-icon orange">
                  T
                </div>

                <h3>
                  Tender Analysis
                </h3>

                <p>
                  Analyze tender requirements
                  and compare them against bidder
                  credentials.
                </p>

              </div>

            </section>
          </>
        )}

        {/* =====================================================
            COMPLIANCE
        ===================================================== */}

        {activeTab === "compliance" && (
          <section className="workspace">

            <div className="section-heading">

              <span className="eyebrow">
                COMPLIANCE ENGINE
              </span>

              <h2>
                Verify Bidder Compliance
              </h2>

              <p>
                Enter the bidder's registration
                details and run the compliance engine.
              </p>

            </div>

            <div className="form-card">

              <div className="form-section-title">
                Bidder Information
              </div>

              <div className="form-grid">

                <div className="input-group full">

                  <label>
                    Bidder / Company Name *
                  </label>

                  <input
                    type="text"
                    placeholder="Enter company name"
                    value={bidderName}
                    onChange={(e) =>
                      setBidderName(e.target.value)
                    }
                  />

                </div>

                <div className="input-group">

                  <label>GSTIN</label>

                  <input
                    type="text"
                    placeholder="Enter GSTIN"
                    value={gstin}
                    onChange={(e) =>
                      setGstin(e.target.value)
                    }
                  />

                </div>

                <div className="input-group">

                  <label>PAN</label>

                  <input
                    type="text"
                    placeholder="Enter PAN"
                    value={pan}
                    onChange={(e) =>
                      setPan(e.target.value)
                    }
                  />

                </div>

                <div className="input-group">

                  <label>UDYAM Number</label>

                  <input
                    type="text"
                    placeholder="Enter UDYAM number"
                    value={udyamNumber}
                    onChange={(e) =>
                      setUdyamNumber(e.target.value)
                    }
                  />

                </div>

                <div className="input-group">

                  <label>EPFO Code</label>

                  <input
                    type="text"
                    placeholder="Enter EPFO code"
                    value={epfoCode}
                    onChange={(e) =>
                      setEpfoCode(e.target.value)
                    }
                  />

                </div>

                <div className="input-group">

                  <label>NSIC Number</label>

                  <input
                    type="text"
                    placeholder="Enter NSIC number"
                    value={nsicNumber}
                    onChange={(e) =>
                      setNsicNumber(e.target.value)
                    }
                  />

                </div>

              </div>

              <button
                className="primary-button verify-button"
                onClick={verifyCompliance}
                disabled={loading}
              >
                {loading
                  ? "Running Compliance Check..."
                  : "Verify Compliance"}
              </button>

            </div>

            {/* ERROR */}

            {error && (
              <div className="error-card">

                <strong>
                  Verification failed
                </strong>

                <p>{error}</p>

              </div>
            )}

            {/* RESULTS */}

            {result && (
              <section className="results">

                <div className="result-header">

                  <div>

                    <span className="eyebrow">
                      COMPLIANCE RESULT
                    </span>

                    <h2>
                      {result.bidder_name ||
                        bidderName}
                    </h2>

                  </div>

                  <div
                    className={`overall-status ${getStatusClass(
                      result.overall_status
                    )}`}
                  >
                    {result.overall_status ||
                      "UNKNOWN"}
                  </div>

                </div>

                <div className="score-card">

                  <div className="score-circle">

                    <span>
                      {result.compliance_score ??
                        result.eligibility_score ??
                        0}
                    </span>

                    <small>
                      /100
                    </small>

                  </div>

                  <div>

                    <h3>
                      Compliance Score
                    </h3>

                    <p>
                      Overall compliance
                      assessment generated by
                      the compliance engine.
                    </p>

                  </div>

                </div>

                {result.flags?.length > 0 && (
                  <div className="flags-card">

                    <h3>
                      Flags & Findings
                    </h3>

                    {result.flags.map(
                      (flag, index) => (
                        <div
                          className="flag"
                          key={index}
                        >
                          ⚠ {flag}
                        </div>
                      )
                    )}

                  </div>
                )}

                {result.ai_summary && (
                  <div className="ai-summary">

                    <div className="ai-summary-header">

                      <span>AI</span>

                      <h3>
                        AI Summary
                      </h3>

                    </div>

                    <p>
                      {result.ai_summary}
                    </p>

                  </div>
                )}

                {result.checks && (
                  <div className="requirements-card">

                    <h3>
                      Compliance Checks
                    </h3>

                    {Object.entries(
                      result.checks
                    ).map(
                      ([key, value]) => (
                        <div
                          className="check-row"
                          key={key}
                        >

                          <span>
                            {key}
                          </span>

                          <strong
                            className={getStatusClass(
                              value?.status
                            )}
                          >
                            {value?.status ||
                              "UNKNOWN"}
                          </strong>

                        </div>
                      )
                    )}

                  </div>
                )}

              </section>
            )}

          </section>
        )}

        {/* =====================================================
            TENDER ANALYSIS
        ===================================================== */}

        {activeTab === "tender" && (
          <section className="workspace">

            <div className="section-heading">

              <span className="eyebrow">
                GEM TENDER INTELLIGENCE
              </span>

              <h2>
                Tender Analysis
              </h2>

              <p>
                Upload a GeM tender document
                and let AI extract the bidder
                requirements.
              </p>

            </div>

            {/* UPLOAD CARD */}

            <div className="upload-card">

              <div className="upload-icon">
                ↑
              </div>

              <h3>
                Upload Tender Document
              </h3>

              <p>
                Upload a GeM tender PDF for
                AI-powered requirement extraction.
              </p>

              <label className="upload-button">

                {tenderFile
                  ? "Change Tender PDF"
                  : "Choose Tender PDF"}

                <input
                  type="file"
                  accept=".pdf,application/pdf"
                  hidden
                  onChange={handleTenderFileChange}
                />

              </label>

              {tenderFile && (
                <div className="selected-file">

                  <strong>
                    Selected file
                  </strong>

                  <span>
                    {tenderFile.name}
                  </span>

                  <small>
                    {(tenderFile.size / 1024 / 1024).toFixed(2)} MB
                  </small>

                </div>
              )}

              <button
                className="primary-button"
                onClick={analyzeTender}
                disabled={
                  tenderLoading ||
                  !tenderFile
                }
              >
                {tenderLoading
                  ? "Analyzing Tender..."
                  : "Analyze Tender"}
              </button>

            </div>

            {/* TENDER ERROR */}

            {tenderError && (
              <div className="error-card">

                <strong>
                  Tender analysis failed
                </strong>

                <p>
                  {tenderError}
                </p>

              </div>
            )}

            {/* SAVE SUCCESS */}

            {tenderSaved && (
              <div className="success-card">

                <strong>
                  ✓ Tender saved successfully
                </strong>

                <p>
                  This tender analysis has been
                  saved in this browser.
                </p>

              </div>
            )}

            {/* TENDER RESULT */}

            {tenderResult && (
              <section className="tender-results">
                <div className="result-header">
                  <div>
                    <span className="eyebrow">
                      TENDER ANALYSIS RESULT
                    </span>

                    <h2>
                      {tenderResult.analysis?.tender_title ||
                        tenderResult.tender_title ||
                        tenderResult.title ||
                        tenderFile?.name ||
                        "Tender Document"}
                    </h2>

                    {(tenderResult.analysis?.tender_reference ||
                      tenderResult.tender_reference ||
                      tenderResult.reference) && (
                      <p>
                        Tender Reference:{" "}
                        <strong>
                          {tenderResult.analysis?.tender_reference ||
                            tenderResult.tender_reference ||
                            tenderResult.reference}
                        </strong>
                      </p>
                    )}
                  </div>

                  <button
                    className="save-button"
                    onClick={saveTender}
                  >
                    {tenderSaved ? "✓ Saved" : "Save Tender"}
                  </button>
                </div>

                {/* BASIC TENDER INFORMATION */}

                {(tenderResult.analysis?.tender_title ||
                  tenderResult.tender_title ||
                  tenderResult.tender_reference ||
                  tenderResult.analysis?.tender_reference ||
                  tenderResult.description ||
                  tenderResult.analysis?.description) && (
                  <div className="tender-info-card">

                    {(tenderResult.analysis?.tender_title ||
                      tenderResult.tender_title) && (
                      <div className="tender-info-item">
                        <span>
                          Tender Title
                        </span>
                        <strong>
                          {tenderResult.analysis?.tender_title ||
                            tenderResult.tender_title}
                        </strong>
                      </div>
                    )}

                    {(tenderResult.analysis?.tender_reference ||
                      tenderResult.tender_reference) && (
                      <div className="tender-info-item">
                        <span>
                          Tender Reference
                        </span>
                        <strong>
                          {tenderResult.analysis?.tender_reference ||
                            tenderResult.tender_reference}
                        </strong>
                      </div>
                    )}

                    {(tenderResult.analysis?.description ||
                      tenderResult.description) && (
                      <div className="tender-info-item full">
                        <span>
                          Description
                        </span>
                        <p>
                          {tenderResult.analysis?.description ||
                            tenderResult.description}
                        </p>
                      </div>
                    )}

                  </div>
                )}

                {/* REQUIREMENTS */}

                {Array.isArray(
                  tenderResult.analysis?.requirements ||
                    tenderResult.requirements
                ) && (
                  <div className="requirements-card">

                    <div className="requirements-header">

                      <div>

                        <h3>
                          Bidder Requirements
                        </h3>

                        <p>
                          AI-extracted requirements
                          from the tender document.
                        </p>

                      </div>

                      <span className="requirement-count">
                        {(tenderResult.analysis?.requirements ||
                          tenderResult.requirements).length}
                      </span>

                    </div>

                    <div className="tender-requirements">

                      {(tenderResult.analysis?.requirements ||
                        tenderResult.requirements).map(
                        (requirement, index) => (

                          <div
                            className="tender-requirement"
                            key={
                              requirement.requirement_id ||
                              index
                            }
                          >

                            <div className="requirement-top">

                              <div>

                                <span className="requirement-id">
                                  {requirement.requirement_id ||
                                    `REQ-${String(
                                      index + 1
                                    ).padStart(3, "0")}`}
                                </span>

                                <h4>
                                  {requirement.title ||
                                    "Requirement"}
                                </h4>

                              </div>

                              <span
                                className={
                                  requirement.mandatory
                                    ? "mandatory-badge"
                                    : "optional-badge"
                                }
                              >
                                {requirement.mandatory
                                  ? "MANDATORY"
                                  : "OPTIONAL"}
                              </span>

                            </div>

                            {requirement.category && (
                              <div className="requirement-category">
                                {requirement.category}
                              </div>
                            )}

                            {requirement.description && (
                              <p>
                                {requirement.description}
                              </p>
                            )}

                            {requirement.verification_type && (
                              <div className="requirement-detail">

                                <strong>
                                  Verification:
                                </strong>

                                <span>
                                  {requirement.verification_type}
                                </span>

                              </div>
                            )}

                            {requirement.period && (
                              <div className="requirement-detail">

                                <strong>
                                  Period:
                                </strong>

                                <span>
                                  {requirement.period}
                                </span>

                              </div>
                            )}

                            {Array.isArray(
                              requirement.required_evidence
                            ) &&
                              requirement
                                .required_evidence
                                .length > 0 && (
                                <div className="evidence-box">

                                  <strong>
                                    Required Evidence
                                  </strong>

                                  <ul>
                                    {requirement.required_evidence.map(
                                      (
                                        evidence,
                                        evidenceIndex
                                      ) => (
                                        <li
                                          key={
                                            evidenceIndex
                                          }
                                        >
                                          {evidence}
                                        </li>
                                      )
                                    )}
                                  </ul>

                                </div>
                              )}

                            {requirement.source_text && (
                              <div className="source-box">

                                <strong>
                                  Source from Tender
                                </strong>

                                <p>
                                  {requirement.source_text}
                                </p>

                              </div>
                            )}

                          </div>

                        )
                      )}

                    </div>

                  </div>
                )}

                {/* FALLBACK JSON */}

                {!Array.isArray(
                  tenderResult.analysis?.requirements ||
                    tenderResult.requirements
                ) && (
                  <div className="requirements-card">

                    <h3>
                      Tender Analysis Data
                    </h3>

                    <pre className="json-result">
                      {JSON.stringify(
                        tenderResult.analysis || tenderResult,
                        null,
                        2
                      )}
                    </pre>

                  </div>
                )}

              </section>
            )}

          </section>
        )}

      </main>

      {/* =========================
          FOOTER
      ========================= */}

      <footer>

        <span>
          GeM Compliance Intelligence
        </span>

        <span>
          AI-powered procurement verification
        </span>

      </footer>

    </div>
  );
}

export default App;