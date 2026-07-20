import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { PlusCircle, MinusCircle, CheckCircle, XCircle } from 'lucide-react';
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

    // Set up Realtime subscriptions so multiple users see live updates
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
    // Fetch one-off transactions
    const { data: txData, error: txError } = await supabase
      .from('transactions')
      .select('*')
      .order('transaction_date', { ascending: false });

    if (txError) console.error("Error fetching transactions:", txError);

    // Fetch active recurring expenses
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
      // Save as a recurring template
      await supabase.from('recurring_expenses').insert([
        { title, amount: Number(amount), repeat_day: Number(repeatDay) }
      ]);
    } else {
      // Save as a standard transaction
      await supabase.from('transactions').insert([
        { type, title, amount: Number(amount), transaction_date: new Date().toISOString() }
      ]);
    }

    // Reset Form
    setTitle('');
    setAmount('');
    setIsRepeated(false);
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

  // Logic to find upcoming payments due within the next 7 days
  const currentDay = getDate(new Date());
  const upcomingPayments = recurring.filter(r =>
    r.repeat_day >= currentDay && r.repeat_day <= currentDay + 7
  );

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8 font-sans">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* Dashboard Header - Available Balance */}
        <div className="bg-white rounded-xl shadow-sm p-6 text-center">
          <h1 className="text-xl text-gray-500 font-medium">Available Balance</h1>
          <h2 className={`text-4xl font-bold mt-2 ${balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            ${balance.toFixed(2)}
          </h2>
        </div>

        {/* Upcoming Payments Alert */}
        {upcomingPayments.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
            <h3 className="font-bold text-yellow-800 mb-2">Upcoming Payments (Next 7 Days)</h3>
            {upcomingPayments.map(payment => (
              <div key={payment.id} className="flex flex-col sm:flex-row justify-between sm:items-center bg-white p-3 rounded shadow-sm mb-2 gap-3">
                <div>
                  <p className="font-semibold">{payment.title} - ${payment.amount}</p>
                  <p className="text-sm text-gray-500">Due on day {payment.repeat_day} of the month</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => markRecurringAsPaid(payment)} className="bg-green-500 text-white p-2 rounded-lg text-sm flex items-center flex-1 justify-center">
                    <CheckCircle size={16} className="mr-1" /> Paid
                  </button>
                  <button onClick={() => stopRecurring(payment.id)} className="bg-red-500 text-white p-2 rounded-lg text-sm flex items-center flex-1 justify-center">
                    <XCircle size={16} className="mr-1" /> Stop
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add Income/Expense Form */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex gap-4 mb-4">
            <button
              onClick={() => setType('income')}
              className={`flex-1 py-2 rounded-lg font-bold flex justify-center items-center transition-colors ${type === 'income' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
            >
              <PlusCircle size={18} className="mr-2" /> Income
            </button>
            <button
              onClick={() => setType('expense')}
              className={`flex-1 py-2 rounded-lg font-bold flex justify-center items-center transition-colors ${type === 'expense' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
            >
              <MinusCircle size={18} className="mr-2" /> Expense
            </button>
          </div>

          <form onSubmit={handleAddTransaction} className="space-y-4">
            <input
              type="text" placeholder="Title (e.g., Salary, Rent)" required
              className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={title} onChange={(e) => setTitle(e.target.value)}
            />
            <input
              type="number" placeholder="Amount" required
              className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={amount} onChange={(e) => setAmount(e.target.value)}
            />

            {type === 'expense' && (
              <div className="flex items-center gap-2 p-2">
                <input
                  type="checkbox" id="repeat"
                  className="w-4 h-4 cursor-pointer"
                  checked={isRepeated} onChange={(e) => setIsRepeated(e.target.checked)}
                />
                <label htmlFor="repeat" className="cursor-pointer select-none">Repeated Monthly</label>
              </div>
            )}

            {isRepeated && type === 'expense' && (
              <input
                type="number" min="1" max="31" placeholder="Date of month to repeat (1-31)" required
                className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={repeatDay} onChange={(e) => setRepeatDay(e.target.value)}
              />
            )}

            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 transition-colors text-white py-3 rounded-lg font-bold">
              Add {type === 'income' ? 'Income' : 'Expense'}
            </button>
          </form>
        </div>

        {/* Recent Activity List */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="font-bold text-lg mb-4">Latest Activity</h3>
          <div className="space-y-3">
            {transactions.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No transactions yet.</p>
            ) : (
              transactions.slice(0, 10).map((tx) => (
                <div key={tx.id} className="flex justify-between items-center border-b pb-3">
                  <div>
                    <p className="font-semibold">{tx.title}</p>
                    <p className="text-xs text-gray-400">{format(new Date(tx.transaction_date), 'MMM dd, yyyy')}</p>
                  </div>
                  <p className={`font-bold ${tx.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                    {tx.type === 'income' ? '+' : '-'}${tx.amount}
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