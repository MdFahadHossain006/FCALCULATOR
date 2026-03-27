import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Calculator as CalcIcon, 
  TrendingUp as GraphUp, 
  FileText, 
  Download, 
  User, 
  ExternalLink, 
  ChevronDown,
  Info,
  Settings,
  History,
  Trash2,
  Maximize2,
  Minimize2
} from 'lucide-react';
import * as math from 'mathjs';
import * as Algebrite from 'algebrite';
import Plotly from 'plotly.js-dist-min';
import html2pdf from 'html2pdf.js';

// --- Types ---
interface CalculationResult {
  expression: string;
  solution: string;
  steps: string[];
  type: 'algebra' | 'calculus' | 'conic' | 'general';
  graphData?: any;
}

// --- Component ---
const Calculator: React.FC = () => {
  const [input, setInput] = useState('');
  const [result, setResult] = useState<CalculationResult | null>(null);
  const [history, setHistory] = useState<CalculationResult[]>([]);
  const [isContactOpen, setIsContactOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const graphRef = useRef<HTMLDivElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);

  // --- Debugging ---
  useEffect(() => {
    console.log('FCALCULATOR: Libraries initialized');
    console.log('MathJS version:', math.version);
    // Algebrite might be a module with a default or a set of functions
    console.log('Algebrite available:', !!Algebrite);
    console.log('Plotly available:', !!Plotly);
    console.log('html2pdf available:', !!html2pdf);
  }, []);

  // --- Math Logic ---
  const getSymbolicEngine = () => {
    // Handle different import styles for Algebrite
    const engine = (Algebrite as any).default || Algebrite;
    if (!engine || typeof engine.run !== 'function') {
      console.error('Algebrite engine structure:', Algebrite);
      throw new Error('Symbolic engine (Algebrite) not properly initialized. Please refresh.');
    }
    return engine;
  };

  const solveAlgebra = (expr: string) => {
    try {
      const engine = getSymbolicEngine();
      // Basic symbolic solving using Algebrite
      const solution = engine.run(`roots(${expr})`).toString();
      return {
        solution: solution === '[]' ? 'No real roots found or complex' : solution,
        steps: [
          `Original Expression: ${expr}`,
          `Applying root finding algorithm...`,
          `Roots: ${solution}`
        ]
      };
    } catch (e: any) {
      console.error('Algebra Error:', e);
      throw new Error(`Algebraic solving failed: ${e.message}`);
    }
  };

  const solveCalculus = (expr: string, type: 'diff' | 'int') => {
    try {
      const engine = getSymbolicEngine();
      let solution = '';
      let steps: string[] = [];

      if (type === 'diff') {
        solution = engine.run(`d(${expr})`).toString();
        steps = [
          `Differentiating: ${expr} with respect to x`,
          `Applying differentiation rules...`,
          `Result: ${solution}`
        ];
      } else {
        solution = engine.run(`integral(${expr})`).toString();
        steps = [
          `Integrating: ${expr} with respect to x`,
          `Applying integration rules...`,
          `Result: ${solution} + C`
        ];
      }
      return { solution, steps };
    } catch (e: any) {
      console.error('Calculus Error:', e);
      throw new Error(`${type === 'diff' ? 'Differentiation' : 'Integration'} failed: ${e.message}`);
    }
  };

  const identifyConic = (expr: string) => {
    // Simple conic identification logic
    const lower = expr.toLowerCase();
    if (lower.includes('x^2') && lower.includes('y^2')) {
      if (lower.includes('+')) return 'Ellipse/Circle';
      if (lower.includes('-')) return 'Hyperbola';
    }
    if ((lower.includes('x^2') && !lower.includes('y^2')) || (!lower.includes('x^2') && lower.includes('y^2'))) {
      return 'Parabola';
    }
    return 'Unknown Conic';
  };

  const handleCalculate = async () => {
    if (!input.trim()) return;
    setIsLoading(true);
    setError(null);

    try {
      let calcResult: CalculationResult;
      const cleanInput = input.trim();

      // Determine type based on keywords or structure
      if (cleanInput.startsWith('diff(') || cleanInput.includes('d/dx')) {
        const expr = cleanInput.replace('diff(', '').replace(')', '').replace('d/dx', '').trim();
        const { solution, steps } = solveCalculus(expr, 'diff');
        calcResult = { expression: cleanInput, solution, steps, type: 'calculus' };
      } else if (cleanInput.startsWith('int(') || cleanInput.includes('∫')) {
        const expr = cleanInput.replace('int(', '').replace(')', '').replace('∫', '').trim();
        const { solution, steps } = solveCalculus(expr, 'int');
        calcResult = { expression: cleanInput, solution, steps, type: 'calculus' };
      } else if (cleanInput.includes('=') || cleanInput.includes('roots(')) {
        const expr = cleanInput.replace('roots(', '').replace(')', '').trim();
        const { solution, steps } = solveAlgebra(expr);
        calcResult = { expression: cleanInput, solution, steps, type: 'algebra' };
      } else {
        // General mathjs evaluation
        const evaluated = math.evaluate(cleanInput);
        calcResult = { 
          expression: cleanInput, 
          solution: evaluated.toString(), 
          steps: [`Evaluating: ${cleanInput}`, `Result: ${evaluated}`], 
          type: 'general' 
        };
      }

      // Conic check
      if (identifyConic(cleanInput) !== 'Unknown Conic') {
        calcResult.type = 'conic';
        calcResult.steps.push(`Identified Conic Section: ${identifyConic(cleanInput)}`);
      }

      setResult(calcResult);
      setHistory(prev => [calcResult, ...prev].slice(0, 10));
      
      // Trigger graphing
      setTimeout(() => plotGraph(calcResult), 100);

    } catch (err: any) {
      setError(err.message || 'An error occurred during calculation');
    } finally {
      setIsLoading(false);
    }
  };

  const plotGraph = (res: CalculationResult) => {
    if (!graphRef.current) return;

    try {
      // Extract function for plotting
      let funcStr = res.expression;
      if (res.type === 'calculus') {
        funcStr = res.solution.replace(' + C', '');
      } else if (res.type === 'algebra') {
        funcStr = res.expression.split('=')[0];
      }

      const xValues = math.range(-10, 10, 0.1).toArray() as number[];
      const yValues = xValues.map(x => {
        try {
          return math.evaluate(funcStr, { x });
        } catch {
          return null;
        }
      });

      const trace = {
        x: xValues,
        y: yValues,
        type: 'scatter',
        mode: 'lines',
        line: { color: '#10b981', width: 3 },
        name: 'f(x)'
      };

      const layout = {
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: { color: '#fff' },
        margin: { t: 20, r: 20, b: 40, l: 40 },
        xaxis: { gridcolor: 'rgba(255,255,255,0.1)', zerolinecolor: '#fff' },
        yaxis: { gridcolor: 'rgba(255,255,255,0.1)', zerolinecolor: '#fff' },
        height: 300,
        autosize: true
      };

      Plotly.newPlot(graphRef.current, [trace as any], layout as any, { responsive: true });
    } catch (e) {
      console.error('Graphing failed', e);
    }
  };

  const exportToPDF = () => {
    if (!exportRef.current) return;
    
    const element = exportRef.current;
    const opt: any = {
      margin: 1,
      filename: 'FCALCULATOR_Result.pdf',
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, backgroundColor: '#0a0a0a' },
      jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
    };

    // Add footer to the element temporarily or clone it
    const footer = document.createElement('div');
    footer.innerHTML = '<p style="text-align: center; font-weight: bold; margin-top: 20px; color: #fff;">THIS RESULT IS CREATED BY FCALCULATOR</p>';
    element.appendChild(footer);

    html2pdf().set(opt).from(element).save().then(() => {
      element.removeChild(footer);
    });
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-emerald-500/30">
      {/* Header */}
      <header className="border-b border-white/10 bg-black/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <CalcIcon className="text-black" size={24} />
            </div>
            <h1 className="text-2xl font-bold tracking-tighter">FCALCULATOR</h1>
          </div>
          
          <div className="text-center">
            <p className="text-xs uppercase tracking-[0.2em] text-emerald-500 font-bold mb-1">Developed By</p>
            <h2 className="text-lg font-serif italic text-white/90">MD FAHAD HOSSAIN</h2>
          </div>

          <div className="relative">
            <button 
              onClick={() => setIsContactOpen(!isContactOpen)}
              className="px-6 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-sm font-medium transition-all flex items-center gap-2 group"
            >
              CONTRACT WITH DEVELOPER
              <ChevronDown size={16} className={`transition-transform duration-300 ${isContactOpen ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
              {isContactOpen && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute right-0 mt-2 w-64 bg-[#151515] border border-white/10 rounded-2xl shadow-2xl p-2 z-50 overflow-hidden"
                >
                  <a 
                    href="https://www.facebook.com/share/1GpbFrgBrL/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3 hover:bg-white/5 rounded-xl transition-colors group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-blue-600/20 flex items-center justify-center text-blue-500">
                      <ExternalLink size={16} />
                    </div>
                    <span className="text-sm font-medium">CONTRACT WITH FACEBOOK</span>
                  </a>
                  <a 
                    href="https://www.instagram.com/mdfahadhossain006?igsh=ZzhhbzljaXVxcmFw" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3 hover:bg-white/5 rounded-xl transition-colors group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-pink-600/20 flex items-center justify-center text-pink-500">
                      <ExternalLink size={16} />
                    </div>
                    <span className="text-sm font-medium">CONTRACT WITH INSTAGRAM</span>
                  </a>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Input & Controls */}
        <div className="lg:col-span-5 space-y-6">
          <section className="bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-sm uppercase tracking-widest text-white/50 font-bold">Mathematical Input</h3>
              <div className="flex gap-2">
                <button onClick={() => setInput('')} className="p-2 hover:bg-white/5 rounded-lg text-white/30 hover:text-white transition-colors">
                  <Trash2 size={18} />
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <textarea 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Enter equation (e.g., x^2 + 2x + 1 = 0 or diff(x^2))"
                className="w-full h-32 bg-black/40 border border-white/10 rounded-2xl p-4 text-xl font-mono focus:outline-none focus:border-emerald-500/50 transition-colors resize-none placeholder:text-white/10"
              />

              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => setInput(prev => prev + 'diff(')}
                  className="p-3 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-xs font-bold tracking-wider transition-all"
                >
                  DIFFERENTIATE
                </button>
                <button 
                  onClick={() => setInput(prev => prev + 'int(')}
                  className="p-3 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-xs font-bold tracking-wider transition-all"
                >
                  INTEGRATE
                </button>
                <button 
                  onClick={() => setInput(prev => prev + 'roots(')}
                  className="p-3 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-xs font-bold tracking-wider transition-all"
                >
                  SOLVE ALGEBRA
                </button>
                <button 
                  onClick={() => setInput(prev => prev + 'x^2 + y^2 = 1')}
                  className="p-3 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-xs font-bold tracking-wider transition-all"
                >
                  CONIC EXAMPLE
                </button>
              </div>

              <button 
                onClick={handleCalculate}
                disabled={isLoading}
                className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-800 text-black font-bold rounded-2xl shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                ) : (
                  <>
                    <CalcIcon size={20} />
                    COMPUTE SOLUTION
                  </>
                )}
              </button>
            </div>
          </section>

          {/* History */}
          <section className="bg-white/5 border border-white/10 rounded-3xl p-6">
            <div className="flex items-center gap-2 mb-4 text-white/50">
              <History size={16} />
              <h3 className="text-xs uppercase tracking-widest font-bold">Recent History</h3>
            </div>
            <div className="space-y-2">
              {history.length === 0 ? (
                <p className="text-sm text-white/20 italic">No recent calculations</p>
              ) : (
                history.map((item, idx) => (
                  <button 
                    key={idx}
                    onClick={() => {
                      setInput(item.expression);
                      setResult(item);
                      setTimeout(() => plotGraph(item), 100);
                    }}
                    className="w-full text-left p-3 hover:bg-white/5 rounded-xl border border-transparent hover:border-white/10 transition-all group"
                  >
                    <p className="text-sm font-mono truncate text-white/70 group-hover:text-white">{item.expression}</p>
                    <p className="text-[10px] uppercase tracking-wider text-emerald-500/50 mt-1">{item.type}</p>
                  </button>
                ))
              )}
            </div>
          </section>
        </div>

        {/* Right Column: Results & Graph */}
        <div className="lg:col-span-7 space-y-6">
          <AnimatePresence mode="wait">
            {error && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 text-red-400 text-sm flex items-center gap-3"
              >
                <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                  <Info size={16} />
                </div>
                {error}
              </motion.div>
            )}

            {result ? (
              <motion.div 
                key={result.expression}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
                ref={exportRef}
              >
                {/* Solution Card */}
                <section className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden">
                  <div className="p-8 border-b border-white/10 flex justify-between items-center">
                    <div>
                      <h3 className="text-sm uppercase tracking-widest text-white/50 font-bold mb-1">Solution</h3>
                      <p className="text-2xl font-mono text-emerald-400">{result.solution}</p>
                    </div>
                    <button 
                      onClick={exportToPDF}
                      className="p-3 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 rounded-2xl transition-all flex items-center gap-2 text-sm font-bold"
                    >
                      <Download size={18} />
                      EXPORT PDF
                    </button>
                  </div>

                  <div className="p-8 space-y-6">
                    <div>
                      <h4 className="text-xs uppercase tracking-widest text-white/30 font-bold mb-4 flex items-center gap-2">
                        <FileText size={14} />
                        Step-by-Step Logic
                      </h4>
                      <div className="space-y-3">
                        {result.steps.map((step, i) => (
                          <div key={i} className="flex gap-4">
                            <span className="text-emerald-500/50 font-mono text-sm">{i + 1}.</span>
                            <p className="text-white/80 text-sm leading-relaxed">{step}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </section>

                {/* Graph Card */}
                <section className="bg-white/5 border border-white/10 rounded-3xl p-8">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-sm uppercase tracking-widest text-white/50 font-bold flex items-center gap-2">
                      <GraphUp size={16} />
                      Interactive Visualization
                    </h3>
                  </div>
                  <div ref={graphRef} className="w-full rounded-2xl overflow-hidden bg-black/20 border border-white/5" />
                </section>
              </motion.div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-12 border-2 border-dashed border-white/5 rounded-3xl opacity-30">
                <CalcIcon size={64} className="mb-6" />
                <h3 className="text-xl font-medium mb-2">Ready to Compute</h3>
                <p className="text-sm max-w-xs">Enter a mathematical expression on the left to see the solution, steps, and interactive graph.</p>
              </div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Footer (for PDF context mainly, but visible in app too) */}
      <footer className="max-w-7xl mx-auto px-6 py-12 border-t border-white/10 text-center">
        <p className="text-white/20 text-xs uppercase tracking-[0.3em]">Premium Engineering Tool &copy; 2026</p>
      </footer>
    </div>
  );
};

export default Calculator;
