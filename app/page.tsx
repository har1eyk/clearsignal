import { WebMCP } from "./WebMCP";

const Arrow = () => <span aria-hidden="true">↗</span>;

const SignalChart = () => (
  <div className="signal-chart" aria-label="Illustrative reaction curve">
    <div className="chart-grid" />
    <div className="axis-label axis-y">SIGNAL</div>
    <div className="axis-label axis-x">REACTION TIME</div>
    <div className="threshold"><span>THRESHOLD</span></div>
    <div className="curve curve-one" />
    <div className="curve curve-two" />
    <div className="curve curve-three" />
    <span className="data-point p1" /><span className="data-point p2" /><span className="data-point p3" />
  </div>
);

export default function Home() {
  return (
    <main data-webmcp-enabled="true">
      <WebMCP />
      <section className="hero" id="top">
        <nav className="nav shell" aria-label="Main navigation">
          <a className="wordmark" href="#top" aria-label="ClearSignal home"><span>CS</span> CLEAR<span className="mark">SIGNAL</span></a>
          <div className="nav-links">
            <a href="#technology">Technology</a><a href="#workflow">Workflow</a><a href="#performance">Performance</a><a href="#applications">Applications</a><a href="#quality">Resources</a>
          </div>
          <a className="button button-small button-cream" href="#contact">Talk to a scientist <Arrow /></a>
          <details className="mobile-menu">
            <summary aria-label="Open navigation">Menu</summary>
            <div><a href="#technology">Technology</a><a href="#workflow">Workflow</a><a href="#performance">Performance</a><a href="#applications">Applications</a><a href="#contact">Contact</a></div>
          </details>
        </nav>

        <div className="hero-grid shell">
          <div className="hero-copy">
            <p className="eyebrow light">ENDOTOXIN DETECTION, RESOLVED</p>
            <h1>From unknown sample to <em>clear result.</em></h1>
            <p className="hero-lede">A more legible path through endotoxin testing—designed to help scientific teams move from assay setup to defensible evidence with confidence.</p>
            <div className="button-row">
              <a className="button button-amber" href="#contact">Request a demo <Arrow /></a>
              <a className="text-link" href="#workflow">Explore the workflow <span aria-hidden="true">↓</span></a>
            </div>
            <div className="hero-notes"><span>01 / SAMPLE</span><span>02 / REACTION</span><span>03 / RESULT</span></div>
          </div>
          <div className="assay-visual" aria-label="Sample moving through an analytical pathway">
            <div className="orbit orbit-outer"/><div className="orbit orbit-inner"/>
            <div className="sample-vial"><span className="vial-cap"/><span className="vial-fill"/><small>S-014</small></div>
            <div className="sample-line"><span className="pulse"/></div>
            <div className="detector"><span className="detector-core"/><span>READ</span></div>
            <div className="result-readout"><small>ASSAY SIGNAL</small><strong>RESOLVED</strong><div className="mini-trace"/></div>
            <span className="particle particle-a"/><span className="particle particle-b"/><span className="particle particle-c"/><span className="particle particle-d"/>
          </div>
        </div>
      </section>

      <section className="intro section" id="technology">
        <div className="shell editorial-grid">
          <div>
            <p className="eyebrow">ENDOTOXIN DETECTION</p>
            <h2>Make critical decisions with clearer evidence.</h2>
          </div>
          <div className="intro-copy">
            <p>ClearSignal is a product concept for teams that test process samples, raw materials, and finished products for bacterial endotoxin. It connects preparation, measurement, controls, and reporting in one coherent workflow.</p>
            <p>The result is not just a number. It is a traceable path from sample identity to analytical interpretation—so reviewers can understand how the answer was reached.</p>
          </div>
        </div>
        <div className="shell principle">
          <div className="principle-step"><span>01</span><div className="droplet"/><h3>Introduce</h3><p>Prepared sample enters the reaction.</p></div>
          <div className="principle-connector"><i/><i/><i/></div>
          <div className="principle-step"><span>02</span><div className="reaction"><b/><b/><b/><b/></div><h3>Detect</h3><p>Endotoxin-dependent signal develops.</p></div>
          <div className="principle-connector"><i/><i/><i/></div>
          <div className="principle-step"><span>03</span><div className="quantify">0.00<br/><strong>EU/mL</strong></div><h3>Quantify</h3><p>Controls and standards frame the result.</p></div>
        </div>
      </section>

      <section className="education section">
        <div className="shell education-grid">
          <div className="lps-visual" aria-label="Abstract lipopolysaccharide structure">
            <div className="lipid-head"><span/><span/><span/></div>
            <div className="chain c1"/><div className="chain c2"/><div className="chain c3"/>
            <p>LIPID A<br/><small>signal-driving region</small></p>
            <div className="molecule-label">LIPOPOLYSACCHARIDE</div>
          </div>
          <div>
            <p className="eyebrow">THE TARGET</p>
            <h2>What is endotoxin?</h2>
            <p className="large-copy">Endotoxins are lipopolysaccharides associated with the outer membrane of Gram-negative bacteria. Testing measures their presence in samples where control of pyrogenic contamination matters.</p>
            <div className="fact-row"><span>FOUND IN</span><p>Pharmaceutical, biotechnology, and medical-device workflows</p></div>
            <div className="fact-row"><span>MEASURED AS</span><p>A biological response compared with known controls and standards</p></div>
            <div className="fact-row"><span>TESTED DURING</span><p>Raw-material review, in-process monitoring, and final release</p></div>
          </div>
        </div>
      </section>

      <section className="workflow section" id="workflow">
        <div className="shell section-heading">
          <div><p className="eyebrow light">SAMPLE TO ANSWER</p><h2>A workflow with no hidden steps.</h2></div>
          <p>This illustrative sequence is ready to be adapted to the exact instrument, reagent, cartridge, or service configuration.</p>
        </div>
        <ol className="shell workflow-line">
          {[
            ["01","Prepare","Identify, dilute, and document the sample."],
            ["02","Load","Add the validated test reagent or cartridge."],
            ["03","React","Run the specified kinetic or endpoint method."],
            ["04","Quantify","Compare the response with controls and standards."],
            ["05","Review","Assess validity, approve, and export the result."],
          ].map(([n,t,d]) => <li key={n}><span>{n}</span><div className="step-dot"/><h3>{t}</h3><p>{d}</p></li>)}
        </ol>
      </section>

      <section className="performance section" id="performance">
        <div className="shell performance-grid">
          <div className="performance-copy">
            <p className="eyebrow light">PERFORMANCE EVIDENCE</p>
            <h2>See the signal. Inspect the evidence.</h2>
            <p>Performance claims belong next to the data that supports them. These purposeful placeholders show where validated study outputs can be added without overstating the product.</p>
            <div className="metric"><span>VALIDATED RANGE</span><strong>[ add study range ]</strong></div>
            <div className="metric"><span>TIME TO RESULT</span><strong>[ add median time ]</strong></div>
          </div>
          <div className="chart-panel">
            <div className="panel-top"><span>ILLUSTRATIVE REACTION PROFILE</span><span>n = [ study sample size ]</span></div>
            <SignalChart />
            <p>Replace with validated kinetic data before publication of product claims.</p>
          </div>
        </div>
        <div className="shell comparison">
          <div className="comparison-heading"><p className="eyebrow light">AGREEMENT STUDY</p><h3>Method comparison, at a glance.</h3></div>
          <div className="scatter" aria-label="Placeholder method comparison chart"><div className="diagonal"/>{Array.from({length:10}).map((_,i)=><i key={i} style={{left:`${15 + (i*7.5)}%`,bottom:`${12 + (i*7.8) + ((i%3)-1)*4}%`}}/>)}<span className="scatter-label">REFERENCE METHOD →</span></div>
          <div className="comparison-note"><span>CORRELATION</span><strong>[ add validated R² ]</strong><p>Illustrative layout only. All published values should link to the underlying validation protocol and acceptance criteria.</p></div>
        </div>
      </section>

      <section className="difference section">
        <div className="shell difference-grid">
          <div><p className="eyebrow">DESIGNED FOR REVIEWABILITY</p><h2>Clarity at every handoff.</h2></div>
          <div className="handoffs">
            <article><span>01</span><h3>Guided execution</h3><p>Keep sample identity, preparation notes, and assay steps connected from the start.</p></article>
            <article><span>02</span><h3>Visible validity</h3><p>Place controls, standards, and acceptance criteria beside the result they support.</p></article>
            <article><span>03</span><h3>Structured reporting</h3><p>Create a review-ready record for scientific, quality, and operational stakeholders.</p></article>
          </div>
        </div>
      </section>

      <section className="applications section" id="applications">
        <div className="shell section-heading dark-text">
          <div><p className="eyebrow">WHERE IT FITS</p><h2>One analytical story, across many sample types.</h2></div>
          <p>Configure the testing approach around the product matrix, process stage, and method requirements—not the other way around.</p>
        </div>
        <div className="shell application-list">
          {[
            ["01","Biologics","In-process and finished-product samples"],
            ["02","Cell & gene therapy","Complex matrices and limited volumes"],
            ["03","Vaccines","Process development through release"],
            ["04","Medical devices","Extraction-based test workflows"],
            ["05","Raw materials & water","Incoming and routine monitoring"],
          ].map(([n,t,d])=><article key={n}><span>{n}</span><h3>{t}</h3><p>{d}</p><b aria-hidden="true">↗</b></article>)}
        </div>
      </section>

      <section className="quality section" id="quality">
        <div className="shell quality-panel">
          <div><p className="eyebrow">QUALITY & IMPLEMENTATION</p><h2>Bring the method into your quality system with the right evidence.</h2></div>
          <div className="quality-list">
            <p><span>01</span> Method-development and validation support</p>
            <p><span>02</span> Lot documentation and certificates</p>
            <p><span>03</span> Data-integrity and audit-trail review</p>
            <p><span>04</span> Technical and regulatory resources</p>
          </div>
          <p className="disclaimer">Specific compendial, regulatory, and compliance statements must be verified for the final product configuration and intended use.</p>
        </div>
      </section>

      <section className="contact section" id="contact">
        <div className="shell contact-grid">
          <div>
            <p className="eyebrow light">START A CONVERSATION</p>
            <h2>Let’s make your endotoxin workflow easier to trust.</h2>
            <p>Tell us what you test and where the current process creates friction. An applications scientist will follow up with a focused next step.</p>
            <div className="contact-signal"><span/><span/><span/><span/><span/></div>
          </div>
          <form className="contact-form" id="contact-form">
            <label>Name<input name="name" autoComplete="name" required maxLength={100} placeholder="Your name" /></label>
            <label>Work email<input type="email" name="email" autoComplete="email" required maxLength={254} placeholder="you@company.com" /></label>
            <div className="form-row"><label>Company<input name="company" autoComplete="organization" maxLength={120} placeholder="Company" /></label><label>Role<input name="role" autoComplete="organization-title" maxLength={120} placeholder="Your role" /></label></div>
            <label>Application or sample type<input name="application" maxLength={160} placeholder="e.g. biologic drug substance" /></label>
            <label>Current testing method<select name="method" defaultValue=""><option value="" disabled>Select a method</option><option>Gel-clot</option><option>Chromogenic</option><option>Turbidimetric</option><option>Recombinant factor C</option><option>Other / evaluating</option></select></label>
            <label>Message<textarea name="message" rows={3} maxLength={1000} placeholder="What would you like to improve?" /></label>
            <label className="consent"><input type="checkbox" name="consent" required/><span>I agree to be contacted about this request. No marketing consent is preselected.</span></label>
            <button className="button button-amber" type="submit">Request a conversation <Arrow /></button>
          </form>
        </div>
      </section>

      <footer>
        <div className="shell footer-top"><a className="wordmark" href="#top"><span>CS</span> CLEAR<span className="mark">SIGNAL</span></a><p>Analytical clarity, from sample to answer.</p><a href="#contact">hello@clearsignal.example</a></div>
        <div className="shell footer-bottom"><span>© 2026 ClearSignal concept</span><div><a href="#technology">Technology</a><a href="#quality">Resources</a><span>Privacy</span><span>Terms</span></div></div>
      </footer>
    </main>
  );
}
