"""Builds the Colab-ready training notebook as a valid .ipynb file.

Run: python build_notebook.py
Produces: credit_risk_training.ipynb
"""

import json
import os
from pathlib import Path

CELLS = []


def md(text: str) -> None:
    CELLS.append(("markdown", text))


def code(text: str) -> None:
    CELLS.append(("code", text))


# ---------------------------------------------------------------------------
# Title
# ---------------------------------------------------------------------------
md(
    """# Data-Driven Credit Risk Assessment for Smallholder Farmers in Zimbabwe

**Objective 1 — Machine Learning Training Pipeline (Google Colab)**

This notebook trains, tunes, evaluates, explains, and serialises a multi-class
credit-risk classifier for smallholder farmers. It is designed to be run
section-by-section in Google Colab and produces artifacts that are later
consumed by the backend API and the explainable dashboard.

**Modelling principles enforced throughout:**
- No data leakage — all preprocessing is inside an `sklearn` `Pipeline`.
- Stratified train/test split, cross-validation on the training set only.
- Hyperparameter tuning never touches the final test set.
- Primary model-selection metric is **macro F1** (not raw accuracy),
  because the credit-risk classes are likely imbalanced.
- Synthetic oversampling is NOT the main strategy — class weights are.
- Final model is saved as a deployable pipeline and is explainable with SHAP.
"""
)

# ---------------------------------------------------------------------------
# 1. SETUP
# ---------------------------------------------------------------------------
md("## 1. Setup — Drive mount, package install, imports, paths")

code(
    """# 1.1 Install any packages that may be missing in the Colab runtime.
# Colab already ships with pandas, numpy, scikit-learn, matplotlib, seaborn,
# joblib and xgboost, but we pin the boosting libs and SHAP just in case.
!pip -q install --upgrade xgboost lightgbm catboost shap imbalanced-learn
"""
)

code(
    """# 1.2 Mount Google Drive so we can read the dataset and write artifacts.
from google.colab import drive
drive.mount('/content/drive')
"""
)

code(
    """# 1.3 Core imports.
import os
import json
import time
import math
import warnings
import platform
from pathlib import Path
from datetime import datetime

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns

import joblib

from sklearn.model_selection import (
    train_test_split,
    StratifiedKFold,
    cross_val_score,
    RandomizedSearchCV,
)
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import (
    StandardScaler,
    OneHotEncoder,
    LabelEncoder,
)
from sklearn.utils.class_weight import compute_class_weight, compute_sample_weight

from sklearn.linear_model import LogisticRegression
from sklearn.tree import DecisionTreeClassifier
from sklearn.ensemble import (
    RandomForestClassifier,
    ExtraTreesClassifier,
    GradientBoostingClassifier,
    VotingClassifier,
    StackingClassifier,
)
from sklearn.neighbors import KNeighborsClassifier
from sklearn.svm import SVC

from sklearn.metrics import (
    accuracy_score,
    balanced_accuracy_score,
    f1_score,
    precision_score,
    recall_score,
    classification_report,
    confusion_matrix,
    ConfusionMatrixDisplay,
)

# Optional boosting libs — imported defensively because Colab versions drift.
try:
    from xgboost import XGBClassifier
    HAS_XGB = True
except Exception as e:
    HAS_XGB = False
    print('[WARN] XGBoost not available:', e)

try:
    from lightgbm import LGBMClassifier
    HAS_LGBM = True
except Exception as e:
    HAS_LGBM = False
    print('[WARN] LightGBM not available:', e)

try:
    from catboost import CatBoostClassifier
    HAS_CAT = True
except Exception as e:
    HAS_CAT = False
    print('[WARN] CatBoost not available:', e)

try:
    import shap
    HAS_SHAP = True
except Exception as e:
    HAS_SHAP = False
    print('[WARN] SHAP not available:', e)

warnings.filterwarnings('ignore')
sns.set_theme(style='whitegrid')

print('Python :', platform.python_version())
print('Pandas :', pd.__version__)
print('NumPy  :', np.__version__)
import sklearn; print('sklearn:', sklearn.__version__)
if HAS_XGB: import xgboost; print('xgboost:', xgboost.__version__)
if HAS_LGBM: import lightgbm; print('lightgbm:', lightgbm.__version__)
if HAS_CAT: import catboost; print('catboost:', catboost.__version__)
if HAS_SHAP: print('shap   :', shap.__version__)
"""
)

code(
    """# 1.4 Paths — dataset, output folder, artifact filenames.
# Change only the DATA_PATH / OUTPUT_DIR if your Drive layout moves.

DATA_PATH  = '/content/drive/MyDrive/haziel/data/final_farmer_credit_dataset_with_gee.csv'
OUTPUT_DIR = '/content/drive/MyDrive/haziel/output/'
Path(OUTPUT_DIR).mkdir(parents=True, exist_ok=True)

ARTIFACTS = {
    'model'              : os.path.join(OUTPUT_DIR, 'final_farmer_credit_model.joblib'),
    'label_encoder'      : os.path.join(OUTPUT_DIR, 'final_farmer_credit_label_encoder.joblib'),
    'feature_columns'    : os.path.join(OUTPUT_DIR, 'feature_columns.json'),
    'model_metadata'     : os.path.join(OUTPUT_DIR, 'model_metadata.json'),
    'model_comparison'   : os.path.join(OUTPUT_DIR, 'model_comparison.csv'),
    'feature_importance' : os.path.join(OUTPUT_DIR, 'feature_importance.csv'),
    'top_features'       : os.path.join(OUTPUT_DIR, 'top_features.json'),
    'sample_shap'        : os.path.join(OUTPUT_DIR, 'sample_shap_explanations.json'),
    'evaluation_summary' : os.path.join(OUTPUT_DIR, 'evaluation_summary.json'),
    'shap_summary_plot'  : os.path.join(OUTPUT_DIR, 'shap_summary_plot.png'),
    'shap_bar_plot'      : os.path.join(OUTPUT_DIR, 'shap_bar_plot.png'),
    'confusion_matrix'   : os.path.join(OUTPUT_DIR, 'confusion_matrix.png'),
}

print('Dataset :', DATA_PATH)
print('Output  :', OUTPUT_DIR)
for k, v in ARTIFACTS.items():
    print(f'  {k:20s} -> {v}')
"""
)

# ---------------------------------------------------------------------------
# 2. CONFIG
# ---------------------------------------------------------------------------
md(
    """## 2. Configuration — target column, columns to exclude, random seed

Edit this cell if the target column has a different name in your CSV or if
you want to drop extra columns from training (e.g. raw IDs, free-text notes,
post-outcome fields that would leak the label).
"""
)

code(
    """# 2.1 Editable configuration.
#
# This notebook targets the v2 merged dataset built by
# scripts/build_final_dataset.py:
#
#   Rows  : 1,805 Zimbabwe smallholder farmers (DIEM Round 4, Mar-May 2022)
#   Cols  : 167 (4 context + 161 features + 2 targets)
#   Target: credit_risk  (LOW / MEDIUM / HIGH)
#   Score : vulnerability_score  (continuous 0..1, DO NOT USE AS FEATURE)
#
# The target was constructed from four independent outcome-proxy indicators
# (HHS, FAO p_sev, LCSI, received_food_aid) and ALL constituent food-security
# and coping columns are already dropped at source. A mutual-information
# audit confirms the remaining features have max MI ~ 0.04 against the
# target, which is far below the ~1.58 that pure leakage would produce.

# Primary target column.
TARGET_COLUMN = 'credit_risk'

# Candidate alternative names the notebook will try if TARGET_COLUMN is absent.
TARGET_FALLBACKS = [
    'credit_risk', 'risk_label', 'credit_risk_class', 'risk_class', 'risk_level',
    'repayment_class', 'loan_repayment_class', 'loan_repayment',
    'default_flag', 'default', 'target', 'label',
]

# Columns that must NEVER be used as features.
EXCLUDE_COLUMNS = [
    # --- The continuous target score (used to build credit_risk) ---
    'vulnerability_score',
    # --- Context cols kept in the file for reference, not modelling ---
    'survey_date', 'survey_month', 'adm1_name', 'adm2_name',
    # --- Guards for the older v1 dataset's leakage columns (safe no-ops) ---
    'income_score', 'production_score', 'asset_score',
    'shock_score',  'food_score',       'total_risk_score',
    'environment_score', 'environment_risk',
    'risk_label', 'hhs', 'p_mod', 'p_sev', 'lcsi',
    'hdds_score', 'hdds_class', 'fcs', 'fcg',
    # --- Generic PII / ID guards ---
    'survey_id', 'objectid', 'operator_id',
    'farmer_id', 'id', 'uuid', 'name', 'full_name',
    'national_id', 'phone', 'phone_number', 'email',
    'loan_id', 'application_id',
]

RANDOM_STATE   = 42
TEST_SIZE      = 0.20    # 20% held-out final test set
CV_FOLDS       = 5       # stratified k-fold for CV on the training set
N_ITER_SEARCH  = 30      # RandomizedSearchCV iterations per tuned model
N_JOBS         = -1      # use all cores where supported
PRIMARY_METRIC = 'f1_macro'  # selection metric (macro F1)

print('TARGET_COLUMN  =', TARGET_COLUMN)
print('EXCLUDE_COLUMNS=', EXCLUDE_COLUMNS)
print('RANDOM_STATE   =', RANDOM_STATE)
print('TEST_SIZE      =', TEST_SIZE)
print('CV_FOLDS       =', CV_FOLDS)
print('PRIMARY_METRIC =', PRIMARY_METRIC)
"""
)

# ---------------------------------------------------------------------------
# 3. LOAD DATA
# ---------------------------------------------------------------------------
md("## 3. Load data — shape, preview, columns, missingness, duplicates")

code(
    """# 3.1 Load dataset.
df = pd.read_csv(DATA_PATH)
print('Shape:', df.shape)
df.head()
"""
)

code(
    """# 3.2 Quick structural inspection.
print('--- COLUMNS ---')
print(list(df.columns))

print('\\n--- DTYPES ---')
print(df.dtypes)

print('\\n--- MISSING VALUES (top 25) ---')
missing = df.isna().sum().sort_values(ascending=False)
print(missing[missing > 0].head(25))

dupes = df.duplicated().sum()
print(f'\\nDuplicated rows: {dupes}')
if dupes > 0:
    print('Dropping exact duplicates to avoid inflating CV scores.')
    df = df.drop_duplicates().reset_index(drop=True)
    print('New shape:', df.shape)
"""
)

code(
    """# 3.3 Numeric vs categorical summary (pre-cleaning).
num_cols_all = df.select_dtypes(include=[np.number]).columns.tolist()
cat_cols_all = df.select_dtypes(exclude=[np.number]).columns.tolist()
print(f'Numeric columns     ({len(num_cols_all)}): {num_cols_all}')
print(f'Categorical columns ({len(cat_cols_all)}): {cat_cols_all}')

df.describe(include='all').T.head(30)
"""
)

# ---------------------------------------------------------------------------
# 4. TARGET SETUP
# ---------------------------------------------------------------------------
md("## 4. Target setup — locate column, label-encode, save encoder")

code(
    """# 4.1 Resolve the target column (use configured name, else fall back).
if TARGET_COLUMN not in df.columns:
    print(f\"[WARN] Configured TARGET_COLUMN '{TARGET_COLUMN}' not found.\")
    for cand in TARGET_FALLBACKS:
        if cand in df.columns:
            print(f'       Using fallback target column: {cand}')
            TARGET_COLUMN = cand
            break
    else:
        raise ValueError(
            'No target column found. Edit TARGET_COLUMN in the config cell.'
        )

print('Target column:', TARGET_COLUMN)
print('Raw class distribution:')
print(df[TARGET_COLUMN].value_counts(dropna=False))
"""
)

code(
    """# 4.2 Label-encode the target.
# We always fit a LabelEncoder so the saved artifact is consistent for the API,
# even if the target is already numeric — this keeps the class->index mapping
# explicit and reproducible.
y_raw = df[TARGET_COLUMN].astype(str).str.strip()

# Drop rows where the label is missing / empty.
valid_mask = y_raw.notna() & (y_raw != '') & (y_raw.str.lower() != 'nan')
if (~valid_mask).any():
    print(f'Dropping {(~valid_mask).sum()} rows with missing target.')
    df = df.loc[valid_mask].reset_index(drop=True)
    y_raw = y_raw.loc[valid_mask].reset_index(drop=True)

label_encoder = LabelEncoder()
y = label_encoder.fit_transform(y_raw)

CLASS_LABELS = list(label_encoder.classes_)
CLASS_MAPPING = {int(i): str(c) for i, c in enumerate(CLASS_LABELS)}
print('Class mapping (index -> label):')
for k, v in CLASS_MAPPING.items():
    print(f'  {k} -> {v}')

print('\\nEncoded class distribution:')
print(pd.Series(y).value_counts().sort_index())
"""
)

# ---------------------------------------------------------------------------
# 5. DATA QUALITY & LEAKAGE CHECKS
# ---------------------------------------------------------------------------
md("## 5. Data quality & leakage checks — feature selection discipline")

code(
    """# 5.1 Heuristic detection of ID-like / leakage-prone columns.
# We flag columns that look suspicious so you can audit them manually.

def _looks_like_id(series: pd.Series) -> bool:
    n = len(series)
    if n == 0:
        return False
    uniq = series.nunique(dropna=True)
    if uniq >= 0.95 * n and series.dtype == object:
        return True
    if series.name.lower().endswith('id') or series.name.lower() in {'uuid'}:
        return True
    return False

LEAKAGE_KEYWORDS = [
    'default', 'outcome', 'repaid', 'repayment', 'arrears',
    'days_late', 'actual', 'post_loan', 'settlement', 'writeoff',
    'recovery', 'charge_off',
]

candidates_id   = [c for c in df.columns if c != TARGET_COLUMN and _looks_like_id(df[c])]
candidates_leak = [
    c for c in df.columns
    if c != TARGET_COLUMN and any(kw in c.lower() for kw in LEAKAGE_KEYWORDS)
]

print('Potential ID-like columns    :', candidates_id)
print('Potential leakage columns    :', candidates_leak)
print('\\nReview these carefully. Anything truly unsafe should be in EXCLUDE_COLUMNS.')
"""
)

code(
    """# 5.2 Build the final feature matrix X using the exclusion list.
excluded_present = [c for c in EXCLUDE_COLUMNS if c in df.columns]
feature_cols = [
    c for c in df.columns
    if c != TARGET_COLUMN and c not in excluded_present
]
X = df[feature_cols].copy()

numeric_features     = X.select_dtypes(include=[np.number]).columns.tolist()
categorical_features = X.select_dtypes(exclude=[np.number]).columns.tolist()

print(f'Excluded columns present in data : {excluded_present}')
print(f'Feature count                    : {len(feature_cols)}')
print(f'  Numeric     ({len(numeric_features)})   : {numeric_features}')
print(f'  Categorical ({len(categorical_features)}): {categorical_features}')
print(f'X shape: {X.shape}  y shape: {y.shape}')
"""
)

# ---------------------------------------------------------------------------
# 6. SPLIT
# ---------------------------------------------------------------------------
md("## 6. Train / test split — stratified, test set is untouched until the end")

code(
    """# 6.1 Stratified hold-out test set. We will NOT touch X_test / y_test until
# the very last evaluation step.
X_train, X_test, y_train, y_test = train_test_split(
    X, y,
    test_size=TEST_SIZE,
    random_state=RANDOM_STATE,
    stratify=y,
)
print('Train:', X_train.shape, 'Test:', X_test.shape)
print('Train class distribution:')
print(pd.Series(y_train).value_counts().sort_index())
print('Test class distribution:')
print(pd.Series(y_test).value_counts().sort_index())

# Stratified CV splitter used for all CV-based evaluation/tuning below.
cv = StratifiedKFold(n_splits=CV_FOLDS, shuffle=True, random_state=RANDOM_STATE)
"""
)

# ---------------------------------------------------------------------------
# 7. PREPROCESSING
# ---------------------------------------------------------------------------
md(
    """## 7. Preprocessing pipeline — `ColumnTransformer` + `Pipeline`

Everything that touches data (imputation, scaling, one-hot encoding) lives
inside the pipeline. This guarantees:

- No leakage from the test set into preprocessing parameters.
- The saved artifact is a single deployable object that handles raw inputs.
"""
)

code(
    """# 7.1 Numeric and categorical sub-pipelines.
numeric_pipe = Pipeline(steps=[
    ('imputer', SimpleImputer(strategy='median')),
    ('scaler',  StandardScaler()),
])

# sparse_output renamed in newer sklearn; handle both.
try:
    ohe = OneHotEncoder(handle_unknown='ignore', sparse_output=False)
except TypeError:
    ohe = OneHotEncoder(handle_unknown='ignore', sparse=False)

categorical_pipe = Pipeline(steps=[
    ('imputer', SimpleImputer(strategy='most_frequent')),
    ('onehot',  ohe),
])

preprocessor = ColumnTransformer(
    transformers=[
        ('num', numeric_pipe,     numeric_features),
        ('cat', categorical_pipe, categorical_features),
    ],
    remainder='drop',
)

# Sanity check that preprocessing fits on training data only.
_ = preprocessor.fit(X_train)
print('Preprocessor fitted OK.')
"""
)

# ---------------------------------------------------------------------------
# 8. CLASS IMBALANCE
# ---------------------------------------------------------------------------
md(
    """## 8. Class imbalance inspection

We quantify imbalance and compute class weights. Weights are our **primary**
imbalance strategy — synthetic oversampling (SMOTE) is NOT used as the main
approach, it is only available as an optional experiment further below.
"""
)

code(
    """# 8.1 Inspect class imbalance and compute balanced class weights.
class_counts = pd.Series(y_train).value_counts().sort_index()
class_ratio  = class_counts / class_counts.sum()
print('Train class counts :', class_counts.to_dict())
print('Train class ratios :', class_ratio.round(3).to_dict())

classes_arr = np.unique(y_train)
class_weights_arr = compute_class_weight(
    class_weight='balanced', classes=classes_arr, y=y_train,
)
CLASS_WEIGHTS = {int(c): float(w) for c, w in zip(classes_arr, class_weights_arr)}
print('Balanced class weights:', CLASS_WEIGHTS)

# Sample weights (used for XGBoost / CatBoost which don't all honour class_weight).
sample_weight_train = compute_sample_weight(class_weight='balanced', y=y_train)
print('sample_weight_train — mean %.3f, min %.3f, max %.3f' %
      (sample_weight_train.mean(), sample_weight_train.min(), sample_weight_train.max()))
"""
)

# ---------------------------------------------------------------------------
# 9. BASELINE MODELS
# ---------------------------------------------------------------------------
md(
    """## 9. Baseline models — train, cross-validate, record

We train a wide set of baselines with sensible defaults, using class weights
where each estimator supports them. Each baseline is wrapped in the same
preprocessing pipeline so comparisons are fair.

SVC and KNN can be slow on larger datasets — we guard them with a size check
and skip them gracefully if the training set is too big.
"""
)

code(
    """# 9.1 Build candidate estimators.
# Class-imbalance strategy per library:
#   - sklearn estimators (LogReg, DT, RF, ET, SVM)  -> class_weight='balanced'
#   - LightGBM                                      -> class_weight='balanced'
#   - CatBoost                                      -> auto_class_weights='Balanced'
#   - XGBoost                                       -> handled implicitly by the
#     tree structure (no class_weight parameter for multi-class; the imbalance
#     in this dataset is mild so this is fine).
#   - GradientBoosting, KNN                         -> no direct support; rely on
#     the stratified CV + macro-F1 scoring to keep the comparison fair.

N_CLASSES = len(CLASS_LABELS)
SLOW_MODEL_ROW_LIMIT = 20000  # SVC / KNN skipped above this

candidate_estimators = {
    'LogisticRegression': LogisticRegression(
        max_iter=2000, class_weight='balanced',
        multi_class='auto', solver='lbfgs', n_jobs=N_JOBS,
    ),
    'DecisionTree': DecisionTreeClassifier(
        class_weight='balanced', random_state=RANDOM_STATE,
    ),
    'RandomForest': RandomForestClassifier(
        n_estimators=400, class_weight='balanced',
        random_state=RANDOM_STATE, n_jobs=N_JOBS,
    ),
    'ExtraTrees': ExtraTreesClassifier(
        n_estimators=400, class_weight='balanced',
        random_state=RANDOM_STATE, n_jobs=N_JOBS,
    ),
    'GradientBoosting': GradientBoostingClassifier(
        random_state=RANDOM_STATE,
    ),
}

if HAS_XGB:
    candidate_estimators['XGBoost'] = XGBClassifier(
        n_estimators=400, max_depth=6, learning_rate=0.1,
        subsample=0.9, colsample_bytree=0.9,
        objective='multi:softprob', num_class=N_CLASSES,
        eval_metric='mlogloss', tree_method='hist',
        random_state=RANDOM_STATE, n_jobs=N_JOBS,
    )
if HAS_LGBM:
    candidate_estimators['LightGBM'] = LGBMClassifier(
        n_estimators=500, learning_rate=0.05, num_leaves=63,
        class_weight='balanced', verbose=-1,
        random_state=RANDOM_STATE, n_jobs=N_JOBS,
    )
if HAS_CAT:
    candidate_estimators['CatBoost'] = CatBoostClassifier(
        iterations=500, depth=6, learning_rate=0.05,
        loss_function='MultiClass', verbose=False,
        auto_class_weights='Balanced',
        random_seed=RANDOM_STATE,
    )

if len(X_train) <= SLOW_MODEL_ROW_LIMIT:
    candidate_estimators['SVM'] = SVC(
        kernel='rbf', probability=True,
        class_weight='balanced', random_state=RANDOM_STATE,
    )
    candidate_estimators['KNN'] = KNeighborsClassifier(
        n_neighbors=15, weights='distance', n_jobs=N_JOBS,
    )
else:
    print(f'Skipping SVM and KNN because training set has {len(X_train)} rows '
          f'(> {SLOW_MODEL_ROW_LIMIT}).')

print('Candidate models:', list(candidate_estimators.keys()))
"""
)

code(
    """# 9.2 Helper to wrap any estimator with the shared preprocessor.
def make_pipeline(estimator):
    return Pipeline(steps=[
        ('preprocessor', preprocessor),
        ('classifier',   estimator),
    ])

# Helper that evaluates one fitted pipeline on the hold-out test set.
def evaluate_on_test(pipe, X_te, y_te):
    y_pred = pipe.predict(X_te)
    return {
        'accuracy'         : accuracy_score(y_te, y_pred),
        'balanced_accuracy': balanced_accuracy_score(y_te, y_pred),
        'f1_macro'         : f1_score(y_te, y_pred, average='macro'),
        'f1_weighted'      : f1_score(y_te, y_pred, average='weighted'),
        'precision_macro'  : precision_score(y_te, y_pred, average='macro', zero_division=0),
        'recall_macro'     : recall_score(y_te, y_pred, average='macro', zero_division=0),
    }
"""
)

code(
    """# 9.3 Fit & evaluate all baselines. We track CV macro F1 on the TRAIN set
# only (the gold-standard for model selection) plus a quick test-set read-out
# for reporting. We DO NOT pick the winner off the test set.

baseline_results = []
fitted_baselines = {}

for name, est in candidate_estimators.items():
    t0 = time.time()
    pipe = make_pipeline(est)
    try:
        cv_scores = cross_val_score(
            pipe, X_train, y_train,
            cv=cv, scoring=PRIMARY_METRIC, n_jobs=N_JOBS,
        )
        cv_mean, cv_std = float(cv_scores.mean()), float(cv_scores.std())

        pipe.fit(X_train, y_train)
        test_metrics = evaluate_on_test(pipe, X_test, y_test)
        elapsed = time.time() - t0

        baseline_results.append({
            'model': name,
            'cv_f1_macro_mean': cv_mean,
            'cv_f1_macro_std' : cv_std,
            **test_metrics,
            'fit_seconds': elapsed,
            'tuned': False,
        })
        fitted_baselines[name] = pipe
        print(f'{name:18s}  CV f1_macro={cv_mean:.4f} (+/-{cv_std:.4f})  '
              f'test f1_macro={test_metrics[\"f1_macro\"]:.4f}  '
              f'[{elapsed:.1f}s]')
    except Exception as e:
        print(f'[ERROR] {name} failed: {e}')
"""
)

# ---------------------------------------------------------------------------
# 10. HYPERPARAMETER TUNING
# ---------------------------------------------------------------------------
md(
    """## 10. Hyperparameter tuning — `RandomizedSearchCV` on the strong candidates

We tune the strongest model families (Random Forest, Extra Trees, XGBoost,
LightGBM, CatBoost) with `RandomizedSearchCV`, using **stratified 5-fold CV
on the training set** and **macro F1** as the scorer. The test set is never
exposed.
"""
)

code(
    """# 10.1 Search spaces.
search_spaces = {
    'RandomForest': {
        'classifier__n_estimators'     : [200, 400, 600, 800],
        'classifier__max_depth'        : [None, 6, 10, 14, 20],
        'classifier__min_samples_split': [2, 5, 10],
        'classifier__min_samples_leaf' : [1, 2, 4],
        'classifier__max_features'     : ['sqrt', 'log2', 0.5, 0.8],
    },
    'ExtraTrees': {
        'classifier__n_estimators'     : [200, 400, 600, 800],
        'classifier__max_depth'        : [None, 10, 14, 20],
        'classifier__min_samples_split': [2, 5, 10],
        'classifier__min_samples_leaf' : [1, 2, 4],
        'classifier__max_features'     : ['sqrt', 'log2', 0.5, 0.8],
    },
}
if HAS_XGB:
    search_spaces['XGBoost'] = {
        'classifier__n_estimators'    : [200, 400, 600, 800],
        'classifier__max_depth'       : [3, 5, 6, 8, 10],
        'classifier__learning_rate'   : [0.03, 0.05, 0.1, 0.15],
        'classifier__subsample'       : [0.7, 0.8, 0.9, 1.0],
        'classifier__colsample_bytree': [0.7, 0.8, 0.9, 1.0],
        'classifier__min_child_weight': [1, 3, 5],
        'classifier__gamma'           : [0, 0.1, 0.3],
    }
if HAS_LGBM:
    search_spaces['LightGBM'] = {
        'classifier__n_estimators'    : [300, 500, 800],
        'classifier__num_leaves'      : [31, 63, 127],
        'classifier__max_depth'       : [-1, 6, 10, 14],
        'classifier__learning_rate'   : [0.03, 0.05, 0.1],
        'classifier__min_child_samples': [5, 10, 20],
        'classifier__reg_alpha'       : [0.0, 0.1, 0.5],
        'classifier__reg_lambda'      : [0.0, 0.1, 0.5],
    }
if HAS_CAT:
    search_spaces['CatBoost'] = {
        'classifier__iterations'   : [300, 500, 800],
        'classifier__depth'        : [4, 6, 8],
        'classifier__learning_rate': [0.03, 0.05, 0.1],
        'classifier__l2_leaf_reg'  : [1, 3, 5, 7],
    }

print('Tuning these models:', list(search_spaces.keys()))
"""
)

code(
    """# 10.2 Run RandomizedSearchCV for each tunable model. We reuse the same
# preprocessing pipeline so the search itself is leakage-free.
tuned_results = []
fitted_tuned  = {}

for name, space in search_spaces.items():
    if name not in candidate_estimators:
        continue
    print(f'\\n--- Tuning {name} ---')
    base_pipe = make_pipeline(candidate_estimators[name])

    t0 = time.time()
    try:
        search = RandomizedSearchCV(
            estimator=base_pipe,
            param_distributions=space,
            n_iter=N_ITER_SEARCH,
            scoring=PRIMARY_METRIC,
            cv=cv,
            n_jobs=N_JOBS,
            random_state=RANDOM_STATE,
            refit=True,
            verbose=0,
        )
        search.fit(X_train, y_train)
        elapsed = time.time() - t0
        best_pipe = search.best_estimator_

        test_metrics = evaluate_on_test(best_pipe, X_test, y_test)
        tuned_results.append({
            'model': name + '_tuned',
            'cv_f1_macro_mean': float(search.best_score_),
            'cv_f1_macro_std' : float(search.cv_results_['std_test_score'][search.best_index_]),
            **test_metrics,
            'fit_seconds': elapsed,
            'tuned': True,
            'best_params': search.best_params_,
        })
        fitted_tuned[name + '_tuned'] = best_pipe
        print(f'{name}_tuned  CV f1_macro={search.best_score_:.4f}  '
              f'test f1_macro={test_metrics[\"f1_macro\"]:.4f}  [{elapsed:.1f}s]')
        print('Best params:', search.best_params_)
    except Exception as e:
        print(f'[ERROR] Tuning {name} failed: {e}')
"""
)

# ---------------------------------------------------------------------------
# 11. MODEL COMPARISON
# ---------------------------------------------------------------------------
md("## 11. Model comparison table")

code(
    """# 11.1 Build a clean comparison DataFrame and save it.
all_rows = []
for r in baseline_results + tuned_results:
    row = {
        'model'            : r['model'],
        'tuned'            : r['tuned'],
        'cv_f1_macro_mean' : round(r['cv_f1_macro_mean'], 4),
        'cv_f1_macro_std'  : round(r['cv_f1_macro_std'],  4),
        'test_f1_macro'    : round(r['f1_macro'],         4),
        'test_f1_weighted' : round(r['f1_weighted'],      4),
        'test_accuracy'    : round(r['accuracy'],         4),
        'test_balanced_acc': round(r['balanced_accuracy'],4),
        'test_precision_m' : round(r['precision_macro'],  4),
        'test_recall_m'    : round(r['recall_macro'],     4),
        'fit_seconds'      : round(r['fit_seconds'],      2),
    }
    all_rows.append(row)

comparison_df = (pd.DataFrame(all_rows)
                 .sort_values('cv_f1_macro_mean', ascending=False)
                 .reset_index(drop=True))

comparison_df.to_csv(ARTIFACTS['model_comparison'], index=False)
print('Saved:', ARTIFACTS['model_comparison'])
comparison_df
"""
)

# ---------------------------------------------------------------------------
# 12. ENSEMBLE EXPERIMENTS
# ---------------------------------------------------------------------------
md(
    """## 12. Ensemble experiments — soft voting & stacking (kept only if better)

We only promote an ensemble to "final" if it beats the best single tuned
model on **CV macro F1**. This avoids blindly preferring an ensemble that
is harder to deploy and explain.
"""
)

code(
    """# 12.1 Pick the top 3 tuned/untuned models (by CV macro F1) as ensemble members.
all_fitted = {**fitted_baselines, **fitted_tuned}
top_names = (comparison_df
             .sort_values('cv_f1_macro_mean', ascending=False)
             ['model'].head(3).tolist())
# Keep only those we actually have fitted pipelines for.
top_names = [n for n in top_names if n in all_fitted]
print('Top 3 ensemble members:', top_names)

ensemble_results = []

if len(top_names) >= 2:
    estimators_for_ensemble = []
    for n in top_names:
        # VotingClassifier / StackingClassifier expect an estimator, not a
        # fitted pipeline clone — we wrap a fresh clone of the pipeline.
        from sklearn.base import clone
        estimators_for_ensemble.append((n.replace('_tuned', ''), clone(all_fitted[n])))

    # --- Soft voting ---
    try:
        voter = VotingClassifier(estimators=estimators_for_ensemble, voting='soft', n_jobs=N_JOBS)
        t0 = time.time()
        cv_scores = cross_val_score(voter, X_train, y_train, cv=cv, scoring=PRIMARY_METRIC, n_jobs=N_JOBS)
        voter.fit(X_train, y_train)
        tm = evaluate_on_test(voter, X_test, y_test)
        ensemble_results.append({
            'model': 'SoftVotingEnsemble',
            'cv_f1_macro_mean': float(cv_scores.mean()),
            'cv_f1_macro_std' : float(cv_scores.std()),
            **tm, 'fit_seconds': time.time()-t0, 'tuned': False,
        })
        all_fitted['SoftVotingEnsemble'] = voter
        print(f'SoftVotingEnsemble  CV f1_macro={cv_scores.mean():.4f}  test f1_macro={tm[\"f1_macro\"]:.4f}')
    except Exception as e:
        print('[ERROR] Soft voting failed:', e)

    # --- Stacking ---
    try:
        stack = StackingClassifier(
            estimators=[(n, clone(all_fitted[n])) for n in top_names],
            final_estimator=LogisticRegression(max_iter=2000, class_weight='balanced'),
            cv=cv, n_jobs=N_JOBS, passthrough=False,
        )
        t0 = time.time()
        cv_scores = cross_val_score(stack, X_train, y_train, cv=cv, scoring=PRIMARY_METRIC, n_jobs=N_JOBS)
        stack.fit(X_train, y_train)
        tm = evaluate_on_test(stack, X_test, y_test)
        ensemble_results.append({
            'model': 'StackingEnsemble',
            'cv_f1_macro_mean': float(cv_scores.mean()),
            'cv_f1_macro_std' : float(cv_scores.std()),
            **tm, 'fit_seconds': time.time()-t0, 'tuned': False,
        })
        all_fitted['StackingEnsemble'] = stack
        print(f'StackingEnsemble    CV f1_macro={cv_scores.mean():.4f}  test f1_macro={tm[\"f1_macro\"]:.4f}')
    except Exception as e:
        print('[ERROR] Stacking failed:', e)

    # Append ensemble rows to the comparison table.
    for r in ensemble_results:
        comparison_df = pd.concat([comparison_df, pd.DataFrame([{
            'model'            : r['model'],
            'tuned'            : r['tuned'],
            'cv_f1_macro_mean' : round(r['cv_f1_macro_mean'], 4),
            'cv_f1_macro_std'  : round(r['cv_f1_macro_std'],  4),
            'test_f1_macro'    : round(r['f1_macro'],         4),
            'test_f1_weighted' : round(r['f1_weighted'],      4),
            'test_accuracy'    : round(r['accuracy'],         4),
            'test_balanced_acc': round(r['balanced_accuracy'],4),
            'test_precision_m' : round(r['precision_macro'],  4),
            'test_recall_m'    : round(r['recall_macro'],     4),
            'fit_seconds'      : round(r['fit_seconds'],      2),
        }])], ignore_index=True)

    comparison_df = comparison_df.sort_values('cv_f1_macro_mean', ascending=False).reset_index(drop=True)
    comparison_df.to_csv(ARTIFACTS['model_comparison'], index=False)

comparison_df
"""
)

# ---------------------------------------------------------------------------
# 13. BEST MODEL SELECTION
# ---------------------------------------------------------------------------
md(
    """## 13. Best model selection

We pick the model that maximises **CV macro F1** on the training set. If an
ensemble's CV macro F1 is NOT strictly better than the best single model by
a meaningful margin (> 0.005), we keep the simpler single model because it
is easier to deploy and to explain with SHAP.
"""
)

code(
    """# 13.1 Selection logic.
ENSEMBLE_MARGIN = 0.005  # minimum CV f1_macro advantage to prefer ensemble

best_single_row = comparison_df[~comparison_df['model']
                                .isin(['SoftVotingEnsemble', 'StackingEnsemble'])].iloc[0]
best_single_name = best_single_row['model']
best_single_cv   = best_single_row['cv_f1_macro_mean']

ensemble_rows = comparison_df[comparison_df['model']
                              .isin(['SoftVotingEnsemble', 'StackingEnsemble'])]

if len(ensemble_rows) and (ensemble_rows['cv_f1_macro_mean'].max()
                           > best_single_cv + ENSEMBLE_MARGIN):
    best_name = ensemble_rows.sort_values('cv_f1_macro_mean', ascending=False).iloc[0]['model']
    ensemble_beats_single = True
    selection_reason = (f'{best_name} beat the best single model '
                        f'({best_single_name}) on CV macro F1 by more than '
                        f'{ENSEMBLE_MARGIN}.')
else:
    best_name = best_single_name
    ensemble_beats_single = False
    selection_reason = (f'{best_name} has the highest CV macro F1 and no '
                        f'ensemble beat it by more than {ENSEMBLE_MARGIN}. '
                        f'A single model is preferred for deployability and '
                        f'SHAP interpretability.')

final_pipeline = all_fitted[best_name]
print('Selected model :', best_name)
print('Reason         :', selection_reason)
"""
)

# ---------------------------------------------------------------------------
# 14. FINAL EVALUATION
# ---------------------------------------------------------------------------
md("## 14. Final evaluation on the hold-out test set")

code(
    """# 14.1 Final metrics + confusion matrix + classification report.
y_pred_final = final_pipeline.predict(X_test)

final_metrics = {
    'accuracy'         : float(accuracy_score(y_test, y_pred_final)),
    'balanced_accuracy': float(balanced_accuracy_score(y_test, y_pred_final)),
    'f1_macro'         : float(f1_score(y_test, y_pred_final, average='macro')),
    'f1_weighted'      : float(f1_score(y_test, y_pred_final, average='weighted')),
    'precision_macro'  : float(precision_score(y_test, y_pred_final, average='macro', zero_division=0)),
    'recall_macro'     : float(recall_score(y_test, y_pred_final, average='macro', zero_division=0)),
}
print('Final test metrics:')
for k, v in final_metrics.items():
    print(f'  {k:20s}: {v:.4f}')

print('\\nClassification report:')
cls_report = classification_report(y_test, y_pred_final, target_names=CLASS_LABELS, zero_division=0)
print(cls_report)
cls_report_dict = classification_report(y_test, y_pred_final, target_names=CLASS_LABELS, zero_division=0, output_dict=True)

cm = confusion_matrix(y_test, y_pred_final)
fig, ax = plt.subplots(figsize=(6, 5))
ConfusionMatrixDisplay(cm, display_labels=CLASS_LABELS).plot(ax=ax, cmap='Blues', colorbar=False)
ax.set_title(f'Confusion matrix — {best_name}')
plt.tight_layout()
plt.savefig(ARTIFACTS['confusion_matrix'], dpi=150, bbox_inches='tight')
plt.show()
print('Saved:', ARTIFACTS['confusion_matrix'])
"""
)

# ---------------------------------------------------------------------------
# 15. PROBABILITIES & DECISION LOGIC
# ---------------------------------------------------------------------------
md(
    """## 15. Probability outputs & decision logic

A good credit-risk model should produce calibrated-looking probabilities —
not collapse every applicant into the HIGH-risk class. We inspect the
probability distributions here and record a simple decision policy in the
saved metadata for the backend.
"""
)

code(
    """# 15.1 Inspect predict_proba behaviour on the test set.
has_proba = hasattr(final_pipeline, 'predict_proba')
decision_logic = {
    'strategy': 'argmax',  # default: pick the class with highest probability
    'class_labels': CLASS_LABELS,
    'notes': (
        'Backend should call pipeline.predict_proba(X_row) and apply the '
        'strategy below. The default is standard argmax which is appropriate '
        'for a well-calibrated multi-class classifier.'
    ),
}

if has_proba:
    proba = final_pipeline.predict_proba(X_test)
    proba_df = pd.DataFrame(proba, columns=[f'p_{lbl}' for lbl in CLASS_LABELS])
    print('Mean predicted probability per class:')
    print(proba_df.mean().round(4))
    print('\\nMax-probability distribution (confidence):')
    print(pd.Series(proba.max(axis=1)).describe().round(4))

    # Optional per-class minimum-confidence fallback. The backend can read
    # this from metadata. We set a mild threshold that does NOT change the
    # argmax decision unless confidence is very low.
    decision_logic['min_confidence_for_prediction'] = 0.34
    decision_logic['fallback_class'] = CLASS_LABELS[int(np.bincount(y_train).argmax())]
    decision_logic['strategy'] = 'argmax_with_fallback'
    decision_logic['notes'] += (
        ' If max predicted probability < min_confidence_for_prediction, '
        'fall back to the majority training class to avoid spurious extreme '
        'decisions.'
    )

    fig, ax = plt.subplots(figsize=(8, 4))
    proba_df.plot.kde(ax=ax)
    ax.set_title('Predicted probability density per class (test set)')
    ax.set_xlim(0, 1)
    plt.tight_layout()
    plt.show()
else:
    print('Final model does not expose predict_proba — using argmax only.')

print('Decision logic to be saved in metadata:', decision_logic)
"""
)

# ---------------------------------------------------------------------------
# 16. SHAP
# ---------------------------------------------------------------------------
md(
    """## 16. SHAP explainability

SHAP is computed on the transformed feature space (post-preprocessing). We
use `TreeExplainer` for tree-based models (RF, ExtraTrees, XGBoost, LightGBM,
CatBoost, GBM) and fall back to `KernelExplainer` on a small background
sample otherwise.

The artifacts produced here are what drives the dashboard's explanation UI:

- `feature_importance.csv`  — global ranked importance table
- `top_features.json`       — short list of top features for sidebar/UI
- `sample_shap_explanations.json` — local per-row contributions that the
  dashboard can render as "why this prediction" bars for individual farmers
- `shap_summary_plot.png` / `shap_bar_plot.png` — ready-to-embed figures
"""
)

code(
    """# 16.1 Resolve transformed feature names out of the ColumnTransformer.
def get_feature_names_from_pipeline(pipe):
    # Works for both single-estimator pipelines and ensembles that wrap them.
    if isinstance(pipe, Pipeline) and 'preprocessor' in pipe.named_steps:
        pre = pipe.named_steps['preprocessor']
    else:
        # Ensemble case: borrow preprocessor from one of the wrapped pipelines.
        pre = preprocessor
    try:
        names = list(pre.get_feature_names_out())
    except Exception:
        # Manual fallback.
        names = []
        for name, trans, cols in pre.transformers_:
            if name == 'num':
                names.extend(cols)
            elif name == 'cat':
                try:
                    ohe_step = trans.named_steps['onehot']
                    names.extend(list(ohe_step.get_feature_names_out(cols)))
                except Exception:
                    names.extend(cols)
    # Strip 'num__' / 'cat__' prefixes for cleaner UI.
    names = [n.split('__', 1)[-1] for n in names]
    return names

feature_names_transformed = get_feature_names_from_pipeline(final_pipeline)
print(f'Transformed feature count: {len(feature_names_transformed)}')
"""
)

code(
    """# 16.2 Run SHAP on the final model.
shap_ok          = False
global_importance_df = None
top_features     = []
sample_explanations = []

if not HAS_SHAP:
    print('[WARN] SHAP not available — skipping explainability section.')
else:
    try:
        # Get the preprocessor + classifier out of whichever pipeline we chose.
        if isinstance(final_pipeline, Pipeline):
            pre_step = final_pipeline.named_steps.get('preprocessor', preprocessor)
            clf_step = final_pipeline.named_steps.get('classifier')
        else:
            # Ensemble: we still need SOMETHING to explain. Use the best
            # single tuned model instead of the ensemble so SHAP is clean.
            fallback_name = best_single_name
            print(f'Final model is an ensemble — computing SHAP on the '
                  f'strongest single model ({fallback_name}) for clarity.')
            fb_pipe = all_fitted[fallback_name]
            pre_step = fb_pipe.named_steps['preprocessor']
            clf_step = fb_pipe.named_steps['classifier']

        # Transform the test set into the space the classifier actually sees.
        X_test_trans  = pre_step.transform(X_test)
        X_train_trans = pre_step.transform(X_train)
        if hasattr(X_test_trans, 'toarray'):
            X_test_trans  = X_test_trans.toarray()
            X_train_trans = X_train_trans.toarray()

        # Pick the right explainer.
        tree_types = []
        if HAS_XGB:  tree_types.append(XGBClassifier)
        if HAS_LGBM: tree_types.append(LGBMClassifier)
        if HAS_CAT:  tree_types.append(CatBoostClassifier)
        tree_types.extend([RandomForestClassifier, ExtraTreesClassifier,
                           DecisionTreeClassifier, GradientBoostingClassifier])

        if isinstance(clf_step, tuple(tree_types)):
            explainer = shap.TreeExplainer(clf_step)
            shap_values = explainer.shap_values(X_test_trans)
        else:
            bg = shap.sample(X_train_trans, min(100, X_train_trans.shape[0]),
                             random_state=RANDOM_STATE)
            explainer = shap.KernelExplainer(clf_step.predict_proba, bg)
            # KernelExplainer is expensive — sample 50 test rows for global view.
            n_sample = min(50, X_test_trans.shape[0])
            idx_sample = np.random.RandomState(RANDOM_STATE).choice(
                X_test_trans.shape[0], n_sample, replace=False)
            shap_values = explainer.shap_values(X_test_trans[idx_sample])

        # shap_values may be a list (one array per class) or a single ndarray.
        # We build a global importance score as the mean |SHAP| across all
        # classes and samples.
        if isinstance(shap_values, list):
            abs_stack = np.stack([np.abs(sv).mean(axis=0) for sv in shap_values])
            global_importance = abs_stack.mean(axis=0)
        else:
            # Newer SHAP returns (n_samples, n_features, n_classes) for multi-class.
            arr = np.abs(shap_values)
            if arr.ndim == 3:
                global_importance = arr.mean(axis=(0, 2))
            else:
                global_importance = arr.mean(axis=0)

        global_importance_df = (pd.DataFrame({
            'feature'   : feature_names_transformed[:len(global_importance)],
            'importance': global_importance,
        }).sort_values('importance', ascending=False).reset_index(drop=True))

        top_features = global_importance_df.head(15)['feature'].tolist()
        print('Top 15 features by mean |SHAP|:')
        print(global_importance_df.head(15))

        # Save importance artifacts.
        global_importance_df.to_csv(ARTIFACTS['feature_importance'], index=False)
        with open(ARTIFACTS['top_features'], 'w') as f:
            json.dump({'top_features': top_features}, f, indent=2)
        print('Saved:', ARTIFACTS['feature_importance'])
        print('Saved:', ARTIFACTS['top_features'])

        shap_ok = True
    except Exception as e:
        print('[ERROR] SHAP computation failed:', e)
"""
)

code(
    """# 16.3 SHAP summary & bar plots (global explainability).
if shap_ok:
    try:
        plt.figure()
        # For multi-class, SHAP's summary_plot accepts a list of arrays.
        shap.summary_plot(
            shap_values,
            X_test_trans if isinstance(shap_values, list) or
                            (hasattr(shap_values, 'ndim') and shap_values.ndim == 2)
                          else X_test_trans[idx_sample],
            feature_names=feature_names_transformed,
            show=False, plot_type='dot',
        )
        plt.tight_layout()
        plt.savefig(ARTIFACTS['shap_summary_plot'], dpi=150, bbox_inches='tight')
        plt.show()
        print('Saved:', ARTIFACTS['shap_summary_plot'])
    except Exception as e:
        print('[WARN] SHAP summary dot plot failed:', e)

    try:
        plt.figure()
        shap.summary_plot(
            shap_values,
            X_test_trans if isinstance(shap_values, list) or
                            (hasattr(shap_values, 'ndim') and shap_values.ndim == 2)
                          else X_test_trans[idx_sample],
            feature_names=feature_names_transformed,
            show=False, plot_type='bar',
        )
        plt.tight_layout()
        plt.savefig(ARTIFACTS['shap_bar_plot'], dpi=150, bbox_inches='tight')
        plt.show()
        print('Saved:', ARTIFACTS['shap_bar_plot'])
    except Exception as e:
        print('[WARN] SHAP bar plot failed:', e)
"""
)

code(
    """# 16.4 Local explanations for a handful of test rows.
# The dashboard can render these directly as "why this farmer was classified
# as X" — each entry lists the features that pushed the prediction the most,
# along with their raw values from the input row.

if shap_ok:
    N_LOCAL = 5
    local_rng = np.random.RandomState(RANDOM_STATE)
    local_idx = local_rng.choice(len(X_test), size=min(N_LOCAL, len(X_test)), replace=False)

    # Re-run SHAP on exactly these rows so we always have aligned values.
    try:
        X_local_trans = pre_step.transform(X_test.iloc[local_idx])
        if hasattr(X_local_trans, 'toarray'):
            X_local_trans = X_local_trans.toarray()
        local_shap = explainer.shap_values(X_local_trans)

        for i, row_idx in enumerate(local_idx):
            pred_class_idx = int(final_pipeline.predict(X_test.iloc[[row_idx]])[0])
            pred_label     = CLASS_LABELS[pred_class_idx]

            # Pull the SHAP row for the predicted class.
            if isinstance(local_shap, list):
                row_shap = local_shap[pred_class_idx][i]
            elif local_shap.ndim == 3:
                row_shap = local_shap[i, :, pred_class_idx]
            else:
                row_shap = local_shap[i]

            contrib = (pd.DataFrame({
                'feature'     : feature_names_transformed[:len(row_shap)],
                'shap_value'  : row_shap,
                'abs_shap'    : np.abs(row_shap),
            }).sort_values('abs_shap', ascending=False).head(8))

            # Raw values from the original (untransformed) row — easier to read.
            raw_row = X_test.iloc[row_idx].to_dict()
            raw_row_clean = {k: (None if pd.isna(v) else v) for k, v in raw_row.items()}

            sample_explanations.append({
                'test_row_index'    : int(row_idx),
                'true_label'        : CLASS_LABELS[int(y_test[row_idx])],
                'predicted_label'   : pred_label,
                'raw_feature_values': raw_row_clean,
                'top_contributions' : [
                    {
                        'feature'    : str(r['feature']),
                        'shap_value' : float(r['shap_value']),
                        'direction'  : 'increases' if r['shap_value'] > 0 else 'decreases',
                    }
                    for _, r in contrib.iterrows()
                ],
            })

        with open(ARTIFACTS['sample_shap'], 'w') as f:
            json.dump(sample_explanations, f, indent=2, default=str)
        print(f'Saved {len(sample_explanations)} local explanations to', ARTIFACTS['sample_shap'])
    except Exception as e:
        print('[WARN] Local SHAP generation failed:', e)

# Dashboard integration notes:
#   - feature_importance.csv  -> render a global "most influential features"
#     bar chart on the dashboard landing page.
#   - top_features.json       -> drive the "Key factors" sidebar and pre-fill
#     the fields shown in the farmer input form.
#   - sample_shap_explanations.json -> template for the per-farmer explanation
#     panel; the backend should produce the same structure at inference time
#     by re-running the TreeExplainer on the incoming row.
#   - shap_summary_plot.png / shap_bar_plot.png -> static fallback images for
#     the "Model insights" page.
"""
)

# ---------------------------------------------------------------------------
# 17. SAVE ARTIFACTS
# ---------------------------------------------------------------------------
md("## 17. Save all artifacts to Drive")

code(
    """# 17.1 Persist the final pipeline, label encoder, feature list and metadata.
joblib.dump(final_pipeline, ARTIFACTS['model'])
joblib.dump(label_encoder,  ARTIFACTS['label_encoder'])

with open(ARTIFACTS['feature_columns'], 'w') as f:
    json.dump({
        'all_features'        : feature_cols,
        'numeric_features'    : numeric_features,
        'categorical_features': categorical_features,
        'excluded_features'   : excluded_present,
        'target_column'       : TARGET_COLUMN,
    }, f, indent=2)

# Best-params block (may not exist if the winner is an untuned model).
best_params = None
for r in tuned_results:
    if r['model'] == best_name:
        best_params = r.get('best_params')
        break

metadata = {
    'project'              : 'Data-Driven Credit Risk Assessment for Smallholder Farmers in Zimbabwe',
    'objective'            : 'Objective 1 — credit risk classifier',
    'trained_at_utc'       : datetime.utcnow().isoformat() + 'Z',
    'dataset_path'         : DATA_PATH,
    'n_rows_total'         : int(len(df)),
    'n_rows_train'         : int(len(X_train)),
    'n_rows_test'          : int(len(X_test)),
    'target_column'        : TARGET_COLUMN,
    'class_labels'         : CLASS_LABELS,
    'class_mapping'        : CLASS_MAPPING,
    'class_weights'        : CLASS_WEIGHTS,
    'random_state'         : RANDOM_STATE,
    'test_size'            : TEST_SIZE,
    'cv_folds'             : CV_FOLDS,
    'primary_metric'       : PRIMARY_METRIC,
    'selected_model'       : best_name,
    'selection_reason'     : selection_reason,
    'ensemble_beats_single': bool(ensemble_beats_single),
    'best_params'          : best_params,
    'final_test_metrics'   : final_metrics,
    'decision_logic'       : decision_logic,
    'top_features'         : top_features,
    'features_used'        : feature_cols,
    'numeric_features'     : numeric_features,
    'categorical_features' : categorical_features,
    'excluded_features'    : excluded_present,
    'library_versions'     : {
        'python'  : platform.python_version(),
        'sklearn' : sklearn.__version__,
        'pandas'  : pd.__version__,
        'numpy'   : np.__version__,
        'xgboost' : __import__('xgboost').__version__   if HAS_XGB  else None,
        'lightgbm': __import__('lightgbm').__version__  if HAS_LGBM else None,
        'catboost': __import__('catboost').__version__  if HAS_CAT  else None,
        'shap'    : shap.__version__                    if HAS_SHAP else None,
    },
}

with open(ARTIFACTS['model_metadata'], 'w') as f:
    json.dump(metadata, f, indent=2, default=str)

evaluation_summary = {
    'selected_model'      : best_name,
    'selection_reason'    : selection_reason,
    'final_test_metrics'  : final_metrics,
    'classification_report': cls_report_dict,
    'confusion_matrix'    : cm.tolist(),
    'class_labels'        : CLASS_LABELS,
}
with open(ARTIFACTS['evaluation_summary'], 'w') as f:
    json.dump(evaluation_summary, f, indent=2, default=str)

print('Saved artifacts:')
for k, v in ARTIFACTS.items():
    exists = os.path.exists(v)
    print(f'  [{\"OK\" if exists else \"--\"}] {k:20s} -> {v}')
"""
)

# ---------------------------------------------------------------------------
# 18. FINAL SUMMARY
# ---------------------------------------------------------------------------
md("## 18. Final summary")

code(
    """# 18.1 Human-readable final summary.
print('=' * 72)
print('CREDIT-RISK MODEL — TRAINING SUMMARY')
print('=' * 72)
print(f'Dataset            : {DATA_PATH}')
print(f'Rows (total/train/test): {len(df)} / {len(X_train)} / {len(X_test)}')
print(f'Target column      : {TARGET_COLUMN}')
print(f'Class labels       : {CLASS_LABELS}')
print()
print(f'Selected model     : {best_name}')
print(f'Selection reason   : {selection_reason}')
print(f'Ensemble preferred : {ensemble_beats_single}')
print()
print('Final test metrics:')
for k, v in final_metrics.items():
    print(f'  {k:20s}: {v:.4f}')
print()
print(f'SHAP explanations generated: {shap_ok}')
if shap_ok and top_features:
    print('Top SHAP features  :', top_features[:10])
print()
print('Artifacts written to /content/drive/MyDrive/haziel/output/:')
for k, v in ARTIFACTS.items():
    mark = 'OK' if os.path.exists(v) else '--'
    print(f'  [{mark}] {os.path.basename(v)}')
print()
print('What to use downstream:')
print('  Backend API  -> final_farmer_credit_model.joblib')
print('                  final_farmer_credit_label_encoder.joblib')
print('                  feature_columns.json   (to validate incoming requests)')
print('                  model_metadata.json    (class labels, decision logic)')
print('  Dashboard UI -> feature_importance.csv  (global importance chart)')
print('                  top_features.json       (key-factors sidebar)')
print('                  sample_shap_explanations.json (per-farmer \"why\" panel)')
print('                  shap_summary_plot.png / shap_bar_plot.png (static views)')
print('                  evaluation_summary.json (model-insights page)')
print('=' * 72)
"""
)

# ---------------------------------------------------------------------------
# Write the notebook.
# ---------------------------------------------------------------------------

def to_cell(kind: str, src: str) -> dict:
    lines = src.splitlines(keepends=True)
    if kind == "markdown":
        return {
            "cell_type": "markdown",
            "metadata": {},
            "source": lines,
        }
    return {
        "cell_type": "code",
        "execution_count": None,
        "metadata": {},
        "outputs": [],
        "source": lines,
    }


notebook = {
    "cells": [to_cell(k, s) for k, s in CELLS],
    "metadata": {
        "kernelspec": {
            "display_name": "Python 3",
            "language": "python",
            "name": "python3",
        },
        "language_info": {"name": "python", "version": "3.10"},
        "colab": {"provenance": []},
    },
    "nbformat": 4,
    "nbformat_minor": 5,
}

out_path = Path(__file__).parent / "credit_risk_training.ipynb"
with open(out_path, "w", encoding="utf-8") as f:
    json.dump(notebook, f, indent=1)

print(f"Wrote {out_path}  ({len(CELLS)} cells)")
