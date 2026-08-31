export const DEFAULT_SCANNER_CONFIG = {
  minMarketCap: 5_000_000_000,
  minAvgVolume: 500_000,
  maxAtrPercent: 8,
  minPrice: 5,
  nearAthPercent: 5,
  near52wHighPercent: 5,
  gapUpMin: 2,
  volumeSpikeRatio: 1.5,
  minRsi: 50,
  maxRsi: 80,
  cupAndHandle: true,
};

export type ScannerConfig = typeof DEFAULT_SCANNER_CONFIG;

export const SCANNER_UNIVERSE: string[] = [
  // ============ Technology ============
  "AAPL","MSFT","GOOGL","GOOG","AMZN","NVDA","META","TSLA","AVGO","ORCL",
  "AMD","TSM","INTC","MU","LRCX","AMAT","KLAC","ADI","MRVL","ASML",
  "NXPI","MPWR","ON","SWKS","QCOM","TXN","MCHP","FTNT","SNPS","CDNS",
  "CRWD","PANW","ZS","OKTA","NET","DDOG","MDB","SNOW","TEAM","WDAY",
  "INTU","ADBE","CRM","NOW","PLTR","SHOP","HUBS","DOCU","TWLO","TTD",
  "VEEV","ANSS","PTC","KEYS","TER","MANH","EPAM","GLOB","GDDY","GEN",
  "CTSH","IT","WIT","ACN","IBM","HPQ","HPE","DELL","NTAP","WDC",
  "STX","SMCI","ANET","FFIV","JNPR","CSCO","MSI","GLW","APH","TEL",
  "ZBRA","TRMB","BR","LDOS","CACI","BAH","SAIC","GRMN","CDW","ENPH",
  "FSLR","SEDG","RUN","ARRY",

  // ============ Consumer Discretionary ============
  "NKE","LULU","CMG","SBUX","MCD","YUM","DPZ","DKNG","WYNN","LVS",
  "MGM","CZR","MAR","HLT","RCL","CCL","NCLH","BKNG","ABNB","EXPE",
  "DASH","LYFT","UBER","RIVN","LCID","F","GM","TM","HMC","RACE",
  "TJX","ROST","BURL","DG","DLTR","FIVE","COST","WMT","TGT","HD",
  "LOW","BBY","ORLY","AZO","AAP","KMX","TSCO","WSM","RH","POOL",
  "DECK","CROX","VFC","PVH","TPR","RL","HAS","MAT","ETSY","W",
  "EBAY","CHWY","PINS","SNAP","RBLX","EA","TTWO","NFLX",

  // ============ Financials ============
  "JPM","BAC","WFC","GS","MS","C","USB","PNC","TFC","CFG",
  "KEY","RF","HBAN","ZION","FITB","MTB","NTRS","STT","BK","SCHW",
  "IBKR","HOOD","LPLA","RJF","MKTX","ICE","CME","CBOE","NDAQ","MCO",
  "SPGI","MSCI","FIS","FISV","GPN","SQ","PYPL","AXP","V","MA",
  "COF","DFS","SYF","ALLY","BLK","BEN","IVZ","TROW","AMG",
  "AIG","ALL","PGR","TRV","CB","MET","PRU","AFL","CINF","HIG",
  "GL","EQH","RGA","AIZ","WRB","L","BRO","MMC","AON","AJG","WTW",

  // ============ Healthcare ============
  "LLY","UNH","JNJ","MRK","PFE","ABBV","TMO","ABT","ISRG","DHR",
  "REGN","VRTX","AMGN","GILD","BMY","BIIB","MRNA","BNTX","ZTS","IDXX",
  "DXCM","PODD","ALGN","HOLX","IQV","CRL","MTD","WAT","A","PKI",
  "BIO","TECH","ILMN","TFX","BAX","BDX","BSX","MDT","SYK","EW",
  "ZBH","GEHC","STE","COO","RMD","INCY","SGEN","EXAS","NTRA","HZNP",
  "JAZZ","NBIX","UTHR","ALNY","RARE","IONS","SRPT","BMRN","PCVX","XENE",
  "HCA","THC","UHS","DVA","CNC","CI","ELV","HUM","MOH","OSCR",
  "CVS","WBA","MCK","ABC","CAH",

  // ============ Industrials ============
  "BA","CAT","DE","HON","GE","RTX","LMT","NOC","GD","HII",
  "TDG","HWM","TXT","LHX","AXON","LDOS","CACI",
  "UPS","FDX","CHRW","XPO","JBHT","ODFL","SAIA","LSTR",
  "WM","RSG","CLH","GNRC","EMR","ROK","AME","NDSN","PNR","XYL",
  "AOS","SWK","SNA","TTC","ITW","PH","ETN","DOV","ROP","IR",
  "OTIS","CARR","JCI","TT","CSL","AIT","MMM","IEX","GGG","FAST",
  "POOL","WAB","GWW","CTAS","PAYX","ADP","PAYC","WEX","CPRT","LKQ",
  "DAL","UAL","LUV","ALK","AAL","JBLU","SAVE",

  // ============ Energy ============
  "XOM","CVX","COP","SLB","OXY","MPC","EOG","PSX","VLO","PXD",
  "FANG","DVN","HES","HAL","BKR","CTRA","MRO","APA","TRGP","WMB",
  "KMI","OKE","ET","EPD","LNG","AR","EQT","SWN","RRC","CHRD",

  // ============ Communication Services ============
  "DIS","CMCSA","T","VZ","TMUS","CHTR","PARA","WBD","FOX","FOXA",
  "NWSA","NWS","OMC","IPG","MTCH","IAC","ZG","Z","SPOT","ROKU",
  "SE","BILI","TME","BIDU","JD","PDD","BABA","LI","NIO","XPEV",

  // ============ Consumer Staples ============
  "PG","PEP","KO","MDLZ","CL","KMB","CHD","CLX","SJM","GIS",
  "K","CAG","HSY","MKC","HRL","TSN","MNST","KDP","STZ","SAM",
  "BF.B","DEO","PM","MO","KVUE","EL","SPC",

  // ============ Utilities ============
  "NEE","DUK","SO","D","AEP","EXC","SRE","XEL","WEC","ED",
  "AES","PPL","PEG","CMS","DTE","EIX","FE","ES","AWK","WTRG",

  // ============ Real Estate ============
  "AMT","PLD","CCI","EQIX","PSA","DLR","O","SPG","WELL","AVB",
  "EQR","VTR","ARE","MAA","UDR","ESS","SUI","ELS","REG","KIM",
  "FRT","HST","PEAK","INVH","VICI","GLPI","CBRE","JLL","CWK",

  // ============ Materials ============
  "LIN","APD","ECL","SHW","PPG","DD","NEM","FCX","GOLD","FMC",
  "CE","EMN","ALB","MLM","VMC","CRH","MOS","CF","NTR","CTVA",
  "DOW","LYB","WRK","IP","PKG","SEE","BLL","AMCR","AVY","IFF",

  // ============ ETFs for tracking ============
  "SPY","QQQ","IWM","DIA","XLK","XLF","XLE","XLV","XLI","XLY",
  "XLP","XLU","XLB","XLRE","XLC",
];

export const SCANNER_UNIVERSE_UNIQUE = Array.from(new Set(SCANNER_UNIVERSE));
