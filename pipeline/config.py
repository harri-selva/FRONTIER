"""
FRONTIER settings. ALL numbers that affect results live here.

FROZEN: these were fixed BEFORE the first backtest run on the test period.
Changing them after seeing results is tuning on the test set. Every run logs a
hash of this file to runs.csv, so any change is visible.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw"
PROC = ROOT / "data" / "processed"
OUT = ROOT / "outputs"
WEB_DATA = ROOT / "web" / "public" / "data"
RUNS_CSV = ROOT / "runs.csv"

SEED = 42
FIELDS = ["medicine", "quant"]
FIELD_NAMES = {"medicine": "Medicine", "quant": "Quant"}

# ---------------------------------------------------------------------------
# Concepts
# ---------------------------------------------------------------------------
MIN_PAPERS = 10          # a concept needs >= 10 papers in the field (counted up to the cutoff)
MAX_SHARE = 0.10         # ...and may appear in at most 10% of the field's papers (else it's a hub word)
MAX_CONCEPTS_PER_PAPER = 30   # papers with more keep the first 30 in alphabetical order (no lookahead)

# Merge spelling variants into one concept (variant -> canonical)
ALIASES = {
    "cone beam ct": "cbct",
    "cone beam computed tomography": "cbct",
    "diffusion magnetic resonance imaging": "diffusion mri",
    "dmri": "diffusion mri",
    "functional magnetic resonance imaging": "fmri",
    "long short term memory": "lstm",
    "pact": "photoacoustic computed tomography",
    "games": "game",
    "tumour": "tumor",
    "artefact": "artifact",
    "covid 19 pandemic": "covid 19",
    "electroencephalogram": "electroencephalography",
    "mc simulation": "monte carlo simulation",
    "dice similarity coefficient": "dice score",
    "dice": "dice score",
    "magnetic resonance image": "mr image",
    "mri image": "mr image",
    "mr imaging": "magnetic resonance imaging",
    "ray computed tomography": "computed tomography",
    "bsde": "backward stochastic differential equation",
    "deep learning approach": "deep learning",
    "deep learning method": "deep learning",
}

# How a concept is shown in the UI (default: the phrase itself)
DISPLAY = {
    "cbct": "CBCT", "fmri": "fMRI", "lstm": "LSTM", "diffusion mri": "diffusion MRI",
    "covid 19": "COVID-19", "garch": "GARCH", "cvar": "CVaR", "imrt": "IMRT", "vmat": "VMAT",
    "spect": "SPECT", "ssim": "SSIM", "psnr": "PSNR", "rmse": "RMSE", "fwhm": "FWHM",
    "mr image": "MR image", "mri reconstruction": "MRI reconstruction", "mri scan": "MRI scan",
    "mri scanner": "MRI scanner", "ct image": "CT image", "ct scan": "CT scan",
    "ct reconstruction": "CT reconstruction", "ct imaging": "CT imaging", "pet image": "PET image",
    "pet scanner": "PET scanner", "pet imaging": "PET imaging", "l evy process": "Lévy process",
    "heston model": "Heston model", "black scholes model": "Black-Scholes model",
    "hjb equation": "HJB equation", "nash equilibrium": "Nash equilibrium",
    "brownian motion": "Brownian motion", "geometric brownian motion": "geometric Brownian motion",
    "monte carlo simulation": "Monte Carlo simulation", "markov chain": "Markov chain",
    "alzheimer s disease": "Alzheimer's disease", "bragg peak": "Bragg peak",
    "united states": "United States", "china": "China", "india": "India", "europe": "Europe",
    "japan": "Japan", "germany": "Germany", "bitcoin": "Bitcoin", "ethereum": "Ethereum",
    "nasdaq": "NASDAQ", "sharpe ratio": "Sharpe ratio", "f1 score": "F1 score",
    "oars": "organs at risk", "esg": "ESG",
}

# Hand-reviewed generic words: not research concepts. Removed everywhere.
# (Reviewed from the most common concepts in each field; see docs/phase0/data_review.md.)
STOPLIST = set("""
period world design methodology constraint cros cross benefit approximation power representation
error objective space path environment evaluation perspective source implementation quality
formula knowledge activity procedure area position coefficient family action reduction weight
complexity principle domain link construction selection threshold service subject transition
shape rise moment turn generation expansion opportunity integration capacity deviation
formulation access architecture statistics people pair connection requirement sense concern
magnitude movement hand computation effort life sequence line specification month light decline
definition proof driver operation adoption history balance advance distance failure calculation
characterization institution participant decade place project speed phase date note
organization topic feedback criterion success consistency strength category percent foundation
reason author instance sign answer code extent location expert paradigm member formation timing
agreement duration difficulty relevance half january expression minute composition validity
fraction variant science majority database peak communication micro party edge similarity
physics precision investigation depth entity significance setup diversity norm creation
applicability association proportion entry pipeline actor identity perception subset delay
deployment word availability usage billion adaptation book object collection universe
exploration disparity confidence week conflict increment scope december occurrence debate
contrary derivation variability disruption github feasibility advancement iteration
modification publication home humans infinity continuity background intensity loss plane center
promise recovery enhancement site frame prototype module contact guidance production
determination hour researcher width extraction growth separation examination patch
verification decision machine silico translation trend alignment discrepancy loop alteration
flexibility room sphere demonstration functionality color inclusion action session
height male female micron situ branch observer house hundred mixture freedom package template
bulk discovery route person regard appearance merit suitability onset expertise node fold
atla elegans percentage tool challenge limitation study result approach analysis
case_study good_agreement percentage_point time_period time_interval data_set case
""".split()) | {"case study", "good agreement", "percentage point", "time period", "time interval",
               "data set", "fold cross", "high sensitivity", "simulation result", "simulation study",
               "feasibility study", "prior knowledge", "long run", "trade off", "closed form solution",
               "computational cost", "computation time", "computational efficiency", "model parameter",
               "model performance", "test set", "training data", "training dataset", "ground truth",
               "gold standard", "hand", "united states", "percent", "scholes"}

# Hand-reviewed academic filler phrases (generated by pattern - "research ...", "... result",
# "growing ...", "potential ..." - then each one checked by hand; real terms such as
# "long memory" or "market impact" were kept).
GENERIC_PHRASES = set("""simulation study
simulation result
parameter value
population level
prior knowledge
model performance
test set
time period
use case
training set
starting point
analysis method
data point
high precision
obtained result
computation time
increasing number
growing interest
small fraction
test case
long period
scientific community
research question
high probability
threshold value
real world application
long distance
vast majority
comprehensive evaluation
analysis tool
great promise
model result
large volume
year period
expected number
best fit
simulation method
research field
performance improvement
known result
research direction
scientific discovery
research area
increasing interest
literature review
large data set
growing number
limiting case
emerging field
future research direction
potential benefit
increasing complexity
pilot study
finite set
fixed number
test result
high confidence
real world scenario
analysis technique
unifying framework
fixed time
varying degree
parameter set
feasibility study
practical implementation
increasing attention
desired property
automated method
small subset
promising alternative
established method
prediction result
research topic
developed method
promising candidate
fundamental principle
research paper
practical guidance
empirical test
research effort
varying level
promising avenue
extended period
model class
approximation method
exact expression
short period
empirical investigation
good fit
empirical evaluation
research group
salient feature
companion paper
complete characterization
classification result
extensive evaluation
large collection
reference point
experiment result
practical applicability
limiting factor
deep learning based approach
practical utility
limited availability
great success
wide array
model framework
better fit
research project
large extent
additional constraint
active area
potential risk
future trend
theoretical modeling
broad applicability
major source
empirical validation
remarkable success
long history
evaluation method
primary objective
basic principle
major cause
competing method
review article
promising strategy
growing literature
fixed size
theoretical perspective
practical relevance
research study
real world problem
principled framework
growing body
theoretical guarantee
theoretical investigation
research work
presented method
straight line
major bottleneck
growing evidence
empirical support
added value
primary driver
research result
large proportion
potential utility
alternative strategy
direct link
application area
exact formula
reduced number
review paper
validation study
long standing challenge
major obstacle
large portion
empirical estimate
substantial reduction
future investigation
step approach
substantial heterogeneity
increasing amount
presented result
common cause
ai technique
commonly used method
large variability
best performing model
research gap
lesser extent
large scale analysis
large scale study
major concern
increasing demand
mathematical proof
influencing factor
i e the number
measured value
scientific knowledge
comprehensive assessment
similar trend
large margin
systematic literature review
real world example
best estimate
monte carlo study
growing need
best strategy
early identification
potential candidate
core component
research finding
large distance
fixed value
long standing problem
formal definition
increasing evidence
substantial gain
high similarity
great significance
varying number
higher correlation
theoretical justification
reasonable agreement
potential source
theoretical expectation
widely used approach
common strategy
contributing factor
additional cost
future perspective
estimation result
resulting framework
practical guide
fixed amount
emerging evidence
increasing level
better estimate
month period
reference method
better agreement
theoretical background
higher complexity
limited knowledge
long term impact
potential bias
pioneering work
considerable effort
theoretical support
growing concern
limited success
rigorous proof
growing demand
theoretical advance
mounting evidence
common belief
large family
small portion
wide applicability
computational perspective
major barrier
direct connection
research purpose
best predictor
emerging area
potential loss
future opportunity
robust foundation
best knowledge
suggested method
good correlation
major contributor
potential avenue
fixed threshold
mathematical perspective
growing importance
increasing trend
additional benefit
large error
large gap
small probability
essential ingredient
practical guideline
long term goal
high robustness
better representation
baseline approach
consecutive day
established approach
major transition
major drawback
small deviation
good predictor
broader perspective
complete picture
developing method
real life application
real world situation
rapidly evolving field
future advancement
higher proportion
potential strategy
considerable promise
empirical testing
known technique
increasing popularity
greater extent
large variance
similar fashion
future trajectory
mathematical definition
notation
myriad
ubiquity
appropriateness
gaussians
software package
dream
toy example
peak number
overall shape
modern society
modern technology
step method
stage framework
numerical case study
extensive simulation study
analytical and numerical result
deep learning dl method
machine learning ml method
ml method
dl method
ml technique
model s performance
research community
best knowledge
good approximation
global population
potential biomarker""".strip().split("\n"))
STOPLIST |= GENERIC_PHRASES

# ---------------------------------------------------------------------------
# Lands (islands)
# ---------------------------------------------------------------------------
# QUANT: arXiv sub-categories. Cross-listed papers use their first q-fin category.
QUANT_LANDS = {
    "q-fin.ST": "Statistical Finance",
    "q-fin.MF": "Mathematical Finance",
    "q-fin.GN": "General Finance",
    "q-fin.EC": "Economics & Econometrics",   # q-fin.EC is arXiv's alias of econ.GN
    "q-fin.RM": "Risk Management",
    "q-fin.CP": "Computational Finance",
    "q-fin.PM": "Portfolio Management",
    "q-fin.TR": "Trading & Microstructure",
    "q-fin.PR": "Pricing of Securities",
    "econ": "Economics & Econometrics",
}
# MEDICINE: one arXiv category, so lands come from clustering the concept graph.
MED_CLUSTER_RESOLUTION = 2.0
MED_MIN_LAND_PAPERS = 120      # smaller clusters merge into their best-connected neighbour
MED_MAX_LANDS = 12             # ...and the smallest keep merging until at most 12 remain
# Names given by hand after reading each cluster's most distinctive concepts.
# A cluster gets the name whose anchor concepts it contains most of.
MED_LAND_NAMES = {
    "Pathology & Radiomics": ["radiomic", "radiomic feature", "eosin", "pathologist", "hematoxylin", "histopathology"],
    "CT Imaging & Reconstruction": ["dect", "dual energy ct", "ct image", "cbct", "ct reconstruction", "image domain"],
    "Cardiovascular Biomechanics": ["artery", "blood flow", "stenosis", "wall shear stress", "aorta", "atrial fibrillation"],
    "Infection & Biomaterials": ["covid 19", "virus", "pathogen", "aerosol", "tissue engineering", "scaffold"],
    "Brain Microstructure MRI": ["diffusion mri", "white matter", "axon", "diffusion tensor imaging", "tractography", "myelin"],
    "Particle Therapy & Radiobiology": ["carbon ion", "cell survival", "proton beam", "dna damage", "bragg peak", "double strand break"],
    "Ultrasound & Photoacoustics": ["aberration", "refraction", "transducer", "ultrasound imaging", "microbubble", "linear array"],
    "Tissue Biomechanics & Surgery": ["finite element model", "surgeon", "biomechanic", "tissue deformation", "tension", "athlete"],
    "Radiotherapy Planning": ["plan quality", "target coverage", "imrt", "treatment plan", "vmat", "dose volume histogram"],
    "MRI Reconstruction": ["space data", "compressed sensing", "acceleration factor", "mri reconstruction", "parallel imaging", "coil sensitivity"],
    "EEG, Epilepsy & Neurorehab": ["eeg recording", "epileptic seizure", "electroencephalography", "spinal cord injury", "epilepsy", "scalp"],
    "PET & Radiation Detectors": ["energy resolution", "pet scanner", "coincidence", "time resolution", "scintillator", "fwhm"],
}

# ---------------------------------------------------------------------------
# Backtest (FROZEN)
# ---------------------------------------------------------------------------
MAIN_CUTOFF = 2018                       # features use papers dated <= 31 Dec 2018
DATA_END = "2026-10-29"                  # last paper in the data; main window = 2019-01-01..DATA_END
ROBUST_CUTOFFS = [2014, 2016, 2018, 2020]
ROBUST_WINDOW = 4                        # years
TRAIN_GAP = 4                            # LightGBM trains at cutoff-4 with labels in the 4 years up to the cutoff
NEG_PER_POS = 10
HOLDOUT = 0.2
TOP_K = [20, 100, 1000]
LGBM_PARAMS = dict(n_estimators=2000, learning_rate=0.03, num_leaves=31, min_child_samples=50,
                   subsample=0.8, subsample_freq=1, colsample_bytree=0.8, reg_lambda=1.0,
                   random_state=SEED, verbose=-1)
EARLY_STOP = 100
# Pre-registered secondary label: the pair reaches >= 2 joint papers inside the window.
SECONDARY_MIN_PAPERS = 2

FEATURES = ["cn", "jaccard", "aa", "ra", "pa", "deg_min", "deg_max",
            "recent_min", "recent_max", "growth_min", "growth_max", "age_min", "age_max",
            "same_land", "is_2hop"]
NOT_FEATURES = ["u", "v", "label", "label2", "label_date", "label_paper"]

# ---------------------------------------------------------------------------
# Website export
# ---------------------------------------------------------------------------
NODES_PER_LAND = 70          # concepts drawn on each island
LINKS_PER_NODE = 3           # strongest existing links drawn per node
GAPS_PER_CONCEPT = 3
GAPS_PER_LAND = 15
GAPS_LEADERBOARD = 40
PAPERS_PER_CONCEPT = 5
# Featured gaps (UI only, not the backtest): both concepts must be reasonably specific
FEATURE_MAX_DEG_PCTL = 0.75   # FEATURED gaps use concepts below the field's 75th degree percentile
FEATURE_MIN_PAPERS = 20       # ...with at least 20 papers each
FEATURE_MAX_PER_CONCEPT = 3   # a concept appears in at most 3 of a land's featured gaps
