// script.js

let expenses = [];

// Initialize the date input to today's date
document.getElementById('date').valueAsDate = new Date();
const Todaydate = new Date();

document.getElementById('expense-form').addEventListener('submit', function(event) {
    event.preventDefault();
    addExpense();
});

function addExpense() {
    let person = document.getElementById('person').value.trim();
    const date = document.getElementById('date').value;
    const item = document.getElementById('item').value.trim();
    const amount = parseFloat(document.getElementById('amount').value);

    // Person field validation
    if (!isNaN(person) || !person ) {
        alert('Invalid input for person field.');
        return;
    }
    person = person.charAt(0).toUpperCase() + person.slice(1).toLowerCase();
	
	  // duplicate validation
    if (expenses.some(exp => exp.person === person && exp.date === date && exp.item === item && exp.amount === amount)) {
        alert('duplicate record.');
        return;
    }

    // Item field validation
    if (!isNaN(item) || !item) {
        alert('Invalid input for item field.');
        return;
    }

    // Amount field validation
    if (isNaN(amount) || amount < 0) {
        alert('Invalid input for amount field.');
        return;
    }
	
    // date field validation
    if (!isNaN(date) || !date) {
        alert('Invalid input for date field.');
        return;
    }
	
    expenses.push({ person, date, item, amount });
    updateExpensesTable();
    updateSummary();
    clearForm();
}

function clearForm() {
    document.getElementById('person').value = '';
    document.getElementById('date').valueAsDate = new Date();
    document.getElementById('item').value = '';
    document.getElementById('amount').value = '';
}

function updateExpensesTable() {
    const tableBody = document.getElementById('expenses-table').querySelector('tbody');
    tableBody.innerHTML = '';

    expenses.forEach((expense, index) => {
        const row = document.createElement('tr');

        const serialCell = document.createElement('td');
        serialCell.textContent = index + 1;
        row.appendChild(serialCell);

        Object.values(expense).forEach(value => {
            const cell = document.createElement('td');
            cell.textContent = value;
            row.appendChild(cell);
        });

        const actionCell = document.createElement('td');
        const deleteButton = document.createElement('button');
        deleteButton.textContent = 'Delete';
        deleteButton.addEventListener('click', () => deleteExpense(index));
        actionCell.appendChild(deleteButton);
        row.appendChild(actionCell);

        tableBody.appendChild(row);
    });
}

function deleteExpense(index) {
    expenses.splice(index, 1);
    updateExpensesTable();
    updateSummary();
}

function updateSummary() {
    const summaryDetails = document.getElementById('summary');
    const settlementDetails = document.getElementById('settlement');
    summaryDetails.innerHTML = '';
    settlementDetails.innerHTML = '';

    const totalExpenses = expenses.reduce((total, expense) => total + expense.amount, 0);
    const peopleExpenses = {};

    expenses.forEach(expense => {
        if (!peopleExpenses[expense.person]) {
            peopleExpenses[expense.person] = 0;
        }
        peopleExpenses[expense.person] += expense.amount;
    });

    summaryDetails.innerHTML = `
        <p><h3>Total Expenses: ${totalExpenses.toFixed(2)} || Each Person: ${(totalExpenses / Object.keys(peopleExpenses).length).toFixed(2)} || Persons: ${Object.keys(peopleExpenses).length} </h3></p>
        <ul>
            ${Object.keys(peopleExpenses).map(person => `<li>${person}: ${peopleExpenses[person].toFixed(2)}</li>`).join('')}
        </ul>
    `;

    const perPersonAmount = totalExpenses / Object.keys(peopleExpenses).length;
    const settlementHTML = Object.keys(peopleExpenses).map(person => {
        const settleAmount = perPersonAmount - peopleExpenses[person];
        return `
		<p><li>${person} ${settleAmount >= 0 ? 'needs to pay' : 'needs to receive'} <span class="${settleAmount >= 0 ? 'negative' : ''}">${Math.abs(settleAmount).toFixed(2)}</span></li></p>`;
    }).join('');

    settlementDetails.innerHTML = settlementHTML;
}

function generatePDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // First table: Expense List
    doc.text('Expense List', 20, 10);

    doc.autoTable({
        startY: 20,
        head: [['Serial No.', 'Person', 'Date', 'Item', 'Amount']],
        body: expenses.map((expense, index) => [
            index + 1,
            expense.person,
            expense.date,
            expense.item,
            `${expense.amount.toFixed(2)}`
        ]),
    });

    let finalY = doc.previousAutoTable.finalY;

    // Second table: Summary
    doc.text('Summary', 20, finalY + 10);

    const summaryData = Object.entries(expenses.reduce((acc, { person, amount }) => {
        if (!acc[person]) acc[person] = 0;
        acc[person] += amount;
        return acc;
    }, {})).map(([person, total], index) => [
        index + 1,
        person,
        `${total.toFixed(2)}`
    ]);

    doc.autoTable({
        startY: finalY + 20,
        head: [['Serial No.', 'Person', 'Total Amount']],
        body: summaryData,
    });

    finalY = doc.previousAutoTable.finalY;

    // Third table: Settlement Amounts
    doc.text('Settlement Amounts', 20, finalY + 10);

    const totalExpenses = summaryData.reduce((acc, [, , total]) => acc + parseFloat(total.replace(' ', '')), 0);
    const perPersonAmount = totalExpenses / summaryData.length;

    const settlementData = summaryData.map(([index, person, total]) => {
        const settleAmount = perPersonAmount - parseFloat(total.replace(' ', ''));
        return [
            index,
            person,
            settleAmount >= 0 ? 'Pay' : 'Receive',
            `${Math.abs(settleAmount).toFixed(2)}`
        ];
    });

    doc.autoTable({
        startY: finalY + 20,
        head: [['Serial No.', 'Person', 'Action', 'Amount']],
        body: settlementData,
    });
	
 finalY = doc.previousAutoTable.finalY;
  // Date and time
    doc.text('eswar @'+Todaydate, 20, finalY + 10);

    doc.save('expense-report.pdf');
}

document.getElementById('download').addEventListener('click', generatePDF);

document.querySelectorAll('th').forEach((header, index) => {
    header.addEventListener('click', () => sortTable(index));
});

function sortTable(columnIndex) {
    const table = document.getElementById('expenses-table');
    const rowsArray = Array.from(table.querySelector('tbody').rows);
    const ascending = table.querySelectorAll('th')[columnIndex].classList.toggle('asc');

    rowsArray.sort((row1, row2) => {
        let cell1 = row1.cells[columnIndex].innerText.toLowerCase();
        let cell2 = row2.cells[columnIndex].innerText.toLowerCase();

        if (columnIndex === 1) { // Date column
            cell1 = new Date(cell1);
            cell2 = new Date(cell2);
        } else if (columnIndex === 4) { // Amount column
            cell1 = parseFloat(cell1.slice(1));
            cell2 = parseFloat(cell2.slice(1));
        }

        return ascending ? cell1.localeCompare(cell2) : cell2.localeCompare(cell1);
    });

    rowsArray.forEach(row => table.querySelector('tbody').appendChild(row));
}
