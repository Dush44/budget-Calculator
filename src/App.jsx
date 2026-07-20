import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { PlusCircle, MinusCircle, CheckCircle, XCircle, DollarSign } from 'lucide-react';
import { format, getDate } from 'date-fns';

function App() {
  const [transactions, setTransactions] = useState([]);
  const [recurring, setRecurring] = useState([]);
  const [balance, setBalance] = useState(0);

  // Form States
  const [type, setType] = useState('income');
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [isRepeated, setIsRepeated] = useState(false);
  const [repeatDay, setRepeatDay] = useState(1);

  useEffect(() => {
    fetchData();

    // Set up Realtime subscriptions
    const channel = supabase
      .channel('schema-db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'recurring_expenses' }, fetchData)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchData = async () => {
    const { data: txData, error: txError } = await supabase
      .from('transactions')
      .select('*')
      .order('transaction_date', { ascending: false });

    if (txError) console.error("Error fetching transactions:", txError);

    const { data: recData, error: recError } = await supabase
      .from('recurring_expenses')
      .select('*')
      .eq('status', 'active');

    if (recError) console.error("Error fetching recurring:", recError);

    setTransactions(txData || []);
    setRecurring(recData || []);

    // Calculate Available Balance
    if (txData) {
      const total = txData.reduce((acc, curr) => {
        return curr.type === 'income' ? acc + Number(curr.amount) : acc - Number(curr.amount);
      }, 0);
      setBalance(total);
    }
  };

  const handleAddTransaction = async (e) => {
    e.preventDefault();
    if (!title || !amount) return;

    if (type === 'expense' && isRepeated) {
      await supabase.from('recurring_expenses').insert([
        { title, amount: Number(amount), repeat_day: Number(repeatDay) }
      ]);
    } else {
      await supabase.from('transactions').insert([
        { type, title, amount: Number(amount), transaction_date: new Date().toISOString() }
      ]);
    }

    setTitle('');
    setAmount('');
    setIsRepeated(false);
    setRepeatDay(1);
  };

  const markRecurringAsPaid = async (recExpense) => {
    await supabase.from('transactions').insert([
      { type: 'expense', title: recExpense.title, amount: recExpense.amount, transaction_date: new Date().toISOString() }
    ]);
    alert(`${recExpense.title} marked as paid!`);
  };

  const stopRecurring = async (id) => {
    await supabase.from('recurring_expenses').update({ status: 'stopped' }).eq('id', id);
  };

  // Find upcoming payments due within the next 7 days
  const currentDay = getDate(new Date());
  const upcomingPayments = recurring.filter(r =>
    r.repeat_day >= currentDay && r.repeat_day <= currentDay + 7
  );

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 p-4 sm:p-6 lg:p-8">
      {/* Desktop constraint container */}
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Dashboard Header */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8 text-center flex flex-col items-center">
          <div className="bg-blue-50 p-3 rounded-full mb-3">
            <DollarSign className="text-blue-500" size={28} />
          </div>
          <h1 className="text-sm uppercase tracking-wider text-gray-500 font-semibold">Available Balance</h1>
          <h2 className={`text-4xl sm:text-5xl font-bold mt-2 tracking-tight ${balance >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
            ${balance.toFixed(2)}
          </h2>
        </div>

        {/* Upcoming Payments Alert */}
        {upcomingPayments.length > 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded-2xl p-5 shadow-sm">
            <h3 className="font-bold text-orange-800 mb-3 text-sm uppercase tracking-wider">Upcoming Bills (Next 7 Days)</h3>
            <div className="space-y-3">
              {upcomingPayments.map(payment => (
                <div key={payment.id} className="flex flex-col sm:flex-row justify-between sm:items-center bg-white p-4 rounded-xl shadow-sm border border-orange-100 gap-4">
                  <div>
                    <p className="font-semibold text-gray-900">{payment.title}</p>
                    <p className="text-sm text-gray-500">Due on day {payment.repeat_day} • <span className="font-medium text-orange-600">${payment.amount}</span></p>
                  </div>
                  <div className="flex gap-2 w-full sm:w-auto">
                    <button onClick={() => markRecurringAsPaid(payment)} className="flex-1 sm:flex-none bg-green-50 text-green-700 hover:bg-green-100 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center border border-green-200">
                      <CheckCircle size={16} className="mr-1.5" /> Paid
                    </button>
                    <button onClick={() => stopRecurring(payment.id)} className="flex-1 sm:flex-none bg-red-50 text-red-700 hover:bg-red-100 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center border border-red-200">
                      <XCircle size={16} className="mr-1.5" /> Stop
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Add Transaction Form */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8">
          <div className="flex bg-gray-100 p-1 rounded-xl mb-6">
            <button
              onClick={() => setType('income')}
              className={`flex-1 py-2.5 rounded-lg font-medium flex justify-center items-center transition-all ${type === 'income' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <PlusCircle size={18} className="mr-2" /> Income
            </button>
            <button
              onClick={() => setType('expense')}
              className={`flex-1 py-2.5 rounded-lg font-medium flex justify-center items-center transition-all ${type === 'expense' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <MinusCircle size={18} className="mr-2" /> Expense
            </button>
          </div>

          <form onSubmit={handleAddTransaction} className="space-y-4">
            <div>
              <input
                type="text" placeholder="Title (e.g., Salary, Groceries)" required
                className="w-full p-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                value={title} onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div>
              <input
                type="number" step="0.01" placeholder="Amount ($)" required
                className="w-full p-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                value={amount} onChange={(e) => setAmount(e.target.value)}
              />
            </div>

            {type === 'expense' && (
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox" id="repeat"
                    className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    checked={isRepeated} onChange={(e) => setIsRepeated(e.target.checked)}
                  />
                  <label htmlFor="repeat" className="cursor-pointer select-none font-medium text-gray-700">Set as monthly recurring expense</label>
                </div>

                {isRepeated && (
                  <div className="mt-4 animate-in fade-in slide-in-from-top-2">
                    <label className="block text-sm text-gray-500 mb-1.5 ml-1">Day of the month to repeat (1-31)</label>
                    <input
                      type="number" min="1" max="31" placeholder="e.g., 15" required
                      className="w-full p-3.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={repeatDay} onChange={(e) => setRepeatDay(e.target.value)}
                    />
                  </div>
                )}
              </div>
            )}

            <button type="submit" className={`w-full py-4 rounded-xl font-bold text-white transition-all shadow-sm hover:shadow-md active:scale-[0.98] ${type === 'income' ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-900 hover:bg-gray-800'}`}>
              Add {type === 'income' ? 'Income' : 'Expense'}
            </button>
          </form>
        </div>

        {/* Recent Activity List */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8">
          <h3 className="font-bold text-gray-900 mb-6 text-lg">Recent Transactions</h3>
          <div className="space-y-4">
            {transactions.length === 0 ? (
              <div className="text-center py-8 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                <p className="text-gray-500">No transactions recorded yet.</p>
              </div>
            ) : (
              transactions.slice(0, 15).map((tx) => (
                <div key={tx.id} className="flex justify-between items-center group">
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-full ${tx.type === 'income' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                      {tx.type === 'income' ? <PlusCircle size={20} /> : <MinusCircle size={20} />}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{tx.title}</p>
                      <p className="text-xs text-gray-500 font-medium">{format(new Date(tx.transaction_date), 'MMM dd, yyyy')}</p>
                    </div>
                  </div>
                  <p className={`font-bold tracking-tight ${tx.type === 'income' ? 'text-green-600' : 'text-gray-900'}`}>
                    {tx.type === 'income' ? '+' : '-'}${Number(tx.amount).toFixed(2)}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

export default App;