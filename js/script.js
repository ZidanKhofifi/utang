document.addEventListener('DOMContentLoaded', () => {
    // ---- Global Variables and Initial Checks ----
    const API_BASE_URL = 'api/'; // Path ke folder API PHP
    let currentUserRole = null;
    let currentUserId = null;
    let currentUsername = null;

    const loginForm = document.getElementById('loginForm');
    const loginMessage = document.getElementById('loginMessage');

    const logoutButton = document.getElementById('logoutButton');
    const welcomeMessage = document.getElementById('welcomeMessage');
    const dashboardTitle = document.getElementById('dashboardTitle');

    // Admin Elements
    const adminControls = document.getElementById('adminControls');
    const showAddDebtFormBtn = document.getElementById('showAddDebtFormBtn');
    const showUserManagementBtn = document.getElementById('showUserManagementBtn');
    const addDebtSection = document.getElementById('addDebtSection');
    const userManagementSection = document.getElementById('userManagementSection');
    const assignUserGroup = document.getElementById('assignUserGroup');
    const assignUserIdSelect = document.getElementById('assignUserId');

    // Debt Form Elements
    const debtForm = document.getElementById('debtForm');
    const debtorNameInput = document.getElementById('debtorName');
    const debtAmountInput = document.getElementById('debtAmount');
    const debtDateInput = document.getElementById('debtDate');
    const debtFormMessage = document.getElementById('debtFormMessage');

    // Debt List Elements
    const debtListSection = document.getElementById('debtListSection');
    const debtList = document.getElementById('debtList');
    const debtListTitle = document.getElementById('debtListTitle');
    const filterStatusSelect = document.getElementById('filterStatus');
    let currentFilter = 'all'; // Default filter

    // User Management Elements
    const showAddUserFormBtn = document.getElementById('showAddUserFormBtn');
    const addUserSection = document.getElementById('addUserSection');
    const userForm = document.getElementById('userForm');
    const newUsernameInput = document.getElementById('newUsername');
    const newUserPasswordInput = document.getElementById('newUserPassword');
    const userFormMessage = document.getElementById('userFormMessage');
    const userList = document.getElementById('userList');

    // User Specific Elements
    const userTotalDebtSection = document.getElementById('userTotalDebt');
    const totalUnpaidAmountSpan = document.getElementById('totalUnpaidAmount');


    // --- Helper Functions ---

    // Fungsi untuk menampilkan pesan (sukses/error)
    function showMessage(element, message, type) {
        element.textContent = message;
        element.className = 'message-text ' + type;
        element.style.display = 'block';
        setTimeout(() => {
            element.style.display = 'none';
        }, 3000); // Pesan hilang setelah 3 detik
    }

    // Fungsi untuk mengarahkan ke halaman lain
    function redirectTo(path) {
        window.location.href = path;
    }

    // Format mata uang Rupiah
    function formatRupiah(amount) {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0
        }).format(amount);
    }

    // --- Authentication Flow ---

    // Cek sesi saat halaman dimuat (untuk dashboard.html)
    async function checkSession() {
        if (window.location.pathname.includes('dashboard.html')) {
            try {
                const response = await fetch(`${API_BASE_URL}auth.php?action=check_session`);
                const data = await response.json();

                if (data.success && data.logged_in) {
                    currentUserRole = data.role;
                    currentUserId = data.user_id;
                    currentUsername = data.username;
                    welcomeMessage.textContent = `Halo, ${currentUsername} (${currentUserRole})!`;
                    renderDashboard(currentUserRole);
                } else {
                    redirectTo('index.html'); // Redirect ke login jika tidak ada sesi
                }
            } catch (error) {
                console.error('Error checking session:', error);
                redirectTo('index.html'); // Redirect ke login jika ada error
            }
        }
    }

    // Render Dashboard berdasarkan peran
    async function renderDashboard(role) {
        if (role === 'admin') {
            dashboardTitle.textContent = 'Dashboard Admin';
            adminControls.style.display = 'flex'; // Tampilkan tombol admin
            assignUserGroup.style.display = 'block'; // Tampilkan select user di form tambah utang
            await fetchUsersForSelect(); // Muat daftar user untuk dropdown
            // Admin default ke lihat daftar utang
            addDebtSection.style.display = 'none';
            userManagementSection.style.display = 'none';
            debtListSection.style.display = 'block';
            userTotalDebtSection.style.display = 'none'; // Sembunyikan total utang user
            fetchDebts(); // Muat daftar utang untuk admin
        } else if (role === 'user') {
            dashboardTitle.textContent = 'Dashboard Utang Saya';
            adminControls.style.display = 'none'; // Sembunyikan tombol admin
            addDebtSection.style.display = 'none'; // Sembunyikan form tambah utang
            userManagementSection.style.display = 'none'; // Sembunyikan manajemen user
            assignUserGroup.style.display = 'none'; // Sembunyikan select user di form tambah utang
            debtListSection.style.display = 'block';
            userTotalDebtSection.style.display = 'block'; // Tampilkan total utang user
            fetchDebts(); // Muat daftar utang untuk user
            fetchTotalUnpaidDebt(); // Muat total utang belum lunas
        }
    }

    // --- Login/Logout Functionality ---

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = loginForm.username.value.trim();
            const password = loginForm.password.value;

            try {
                const response = await fetch(`${API_BASE_URL}auth.php?action=login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });
                const data = await response.json();

                if (data.success) {
                    showMessage(loginMessage, data.message, 'success');
                    setTimeout(() => redirectTo('dashboard.html'), 1000);
                } else {
                    showMessage(loginMessage, data.message, 'error');
                }
            } catch (error) {
                console.error('Login error:', error);
                showMessage(loginMessage, 'Terjadi kesalahan saat login.', 'error');
            }
        });
    }

    if (logoutButton) {
        logoutButton.addEventListener('click', async () => {
            if (confirm('Yakin ingin logout?')) {
                try {
                    const response = await fetch(`${API_BASE_URL}auth.php?action=logout`, {
                        method: 'POST'
                    });
                    const data = await response.json();
                    if (data.success) {
                        redirectTo('index.html');
                    } else {
                        alert('Gagal logout: ' + data.message);
                    }
                } catch (error) {
                    console.error('Logout error:', error);
                    alert('Terjadi kesalahan saat logout.');
                }
            }
        });
    }

    // --- Debt Management (Shared by User & Admin, with role-based access) ---

    async function fetchDebts() {
        try {
            const response = await fetch(`${API_BASE_URL}debts.php?action=read&status=${currentFilter}`);
            const data = await response.json();

            if (data.success) {
                displayDebts(data.debts);
            } else {
                console.error('Error fetching debts:', data.message);
                showMessage(debtFormMessage, 'Gagal mengambil data utang: ' + data.message, 'error');
            }
        } catch (error) {
            console.error('Error fetching debts:', error);
            showMessage(debtFormMessage, 'Terjadi kesalahan saat mengambil data utang.', 'error');
        }
    }

    function displayDebts(debts) {
        debtList.innerHTML = '';
        if (debts.length === 0) {
            debtList.innerHTML = '<p style="text-align: center; color: var(--secondary-color);">Belum ada utang tercatat.</p>';
            return;
        }

        debts.forEach(debt => {
            const listItem = document.createElement('li');
            listItem.setAttribute('data-id', debt.id);
            if (debt.is_paid == 1) { // Perhatikan perbandingan dengan 1 karena dari DB adalah int
                listItem.classList.add('paid');
            }

            const formattedAmount = formatRupiah(debt.amount);
            const formattedDate = new Date(debt.debt_date + 'T00:00:00').toLocaleDateString('id-ID'); // Tambahkan T00:00:00 untuk menghindari masalah zona waktu
            const statusText = debt.is_paid == 1 ? 'Lunas' : 'Belum Lunas';
            const statusClass = debt.is_paid == 1 ? 'status-paid' : 'status-unpaid';
            const ownerInfo = currentUserRole === 'admin' ? `<br><strong>Pemilik:</strong> ${debt.owner_username}` : ''; // Tampilkan pemilik hanya untuk admin

            listItem.innerHTML = `
                <div class="debt-info">
                    <strong>Nama Peminjam:</strong> ${debt.debtor_name}<br>
                    <strong>Jumlah:</strong> ${formattedAmount}<br>
                    <strong>Tanggal:</strong> ${formattedDate}${ownerInfo}<br>
                    <strong>Status:</strong> <span class="${statusClass}">${statusText}</span>
                </div>
                <div class="debt-actions">
                    ${currentUserRole === 'admin' ? `
                        <button class="btn success-btn mark-paid" ${debt.is_paid == 1 ? 'disabled' : ''}>${debt.is_paid == 1 ? 'Sudah Lunas' : 'Tandai Lunas'}</button>
                        <button class="btn danger-btn delete-debt">Hapus</button>
                    ` : ''}
                </div>
            `;

            if (currentUserRole === 'admin') {
                const markPaidButton = listItem.querySelector('.mark-paid');
                if (markPaidButton) {
                    markPaidButton.addEventListener('click', async () => {
                        const debtId = listItem.getAttribute('data-id');
                        const newStatus = debt.is_paid == 0 ? 1 : 0; // Toggle status
                        try {
                            const response = await fetch(`${API_BASE_URL}debts.php?action=update_status`, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ id: debtId, is_paid: newStatus })
                            });
                            const data = await response.json();
                            if (data.success) {
                                showMessage(debtFormMessage, data.message, 'success');
                                fetchDebts(); // Muat ulang daftar
                            } else {
                                showMessage(debtFormMessage, data.message, 'error');
                            }
                        } catch (error) {
                            console.error('Error updating debt status:', error);
                            showMessage(debtFormMessage, 'Terjadi kesalahan saat memperbarui status utang.', 'error');
                        }
                    });
                }

                const deleteButton = listItem.querySelector('.delete-debt');
                if (deleteButton) {
                    deleteButton.addEventListener('click', async () => {
                        const debtId = listItem.getAttribute('data-id');
                        if (confirm('Yakin ingin menghapus utang ini?')) {
                            try {
                                const response = await fetch(`${API_BASE_URL}debts.php?action=delete`, {
                                    method: 'DELETE',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ id: debtId })
                                });
                                const data = await response.json();
                                if (data.success) {
                                    showMessage(debtFormMessage, data.message, 'success');
                                    fetchDebts(); // Muat ulang daftar
                                } else {
                                    showMessage(debtFormMessage, data.message, 'error');
                                }
                            } catch (error) {
                                console.error('Error deleting debt:', error);
                                showMessage(debtFormMessage, 'Terjadi kesalahan saat menghapus utang.', 'error');
                            }
                        }
                    });
                }
            }
            debtList.appendChild(listItem);
        });
    }

    if (filterStatusSelect) {
        filterStatusSelect.addEventListener('change', () => {
            currentFilter = filterStatusSelect.value;
            fetchDebts();
        });
    }

    // --- Admin-specific Functionality ---

    if (showAddDebtFormBtn) {
        showAddDebtFormBtn.addEventListener('click', () => {
            addDebtSection.style.display = 'block';
            userManagementSection.style.display = 'none';
            debtListSection.style.display = 'none';
            debtFormMessage.textContent = ''; // Clear message
        });
    }

    if (showUserManagementBtn) {
        showUserManagementBtn.addEventListener('click', () => {
            userManagementSection.style.display = 'block';
            addDebtSection.style.display = 'none';
            debtListSection.style.display = 'none';
            fetchUsers(); // Muat daftar user
            userFormMessage.textContent = ''; // Clear message
        });
    }

    if (debtForm) {
        debtForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const debtor_name = debtorNameInput.value.trim();
            const amount = parseFloat(debtAmountInput.value);
            const debt_date = debtDateInput.value;
            const user_id = assignUserIdSelect.value; // Ambil user ID dari select

            if (!debtor_name || isNaN(amount) || amount <= 0 || !debt_date || !user_id) {
                showMessage(debtFormMessage, 'Mohon lengkapi semua bidang dengan benar, termasuk memilih pemilik.', 'error');
                return;
            }

            try {
                const response = await fetch(`${API_BASE_URL}debts.php?action=create`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ debtor_name, amount, debt_date, user_id })
                });
                const data = await response.json();

                if (data.success) {
                    showMessage(debtFormMessage, data.message, 'success');
                    debtorNameInput.value = '';
                    debtAmountInput.value = '';
                    debtDateInput.value = '';
                    // Kembali ke daftar utang setelah berhasil menambah
                    addDebtSection.style.display = 'none';
                    debtListSection.style.display = 'block';
                    fetchDebts();
                } else {
                    showMessage(debtFormMessage, data.message, 'error');
                }
            } catch (error) {
                console.error('Error adding debt:', error);
                showMessage(debtFormMessage, 'Terjadi kesalahan saat menambahkan utang.', 'error');
            }
        });
    }

// --- User Management (Admin Only) ---

    async function fetchUsersForSelect() {
        try {
            // Ini tetap memanggil 'read' biasa karena hanya butuh ID dan username
            const response = await fetch(`${API_BASE_URL}users.php?action=read`);
            const data = await response.json();
            if (data.success) {
                assignUserIdSelect.innerHTML = ''; // Kosongkan dulu
                // Tambahkan opsi default
                const defaultOption = document.createElement('option');
                defaultOption.value = '';
                defaultOption.textContent = 'Pilih Pengguna...';
                defaultOption.disabled = true;
                defaultOption.selected = true;
                assignUserIdSelect.appendChild(defaultOption);

                data.users.forEach(user => {
                    const option = document.createElement('option');
                    option.value = user.id;
                    option.textContent = user.username;
                    assignUserIdSelect.appendChild(option);
                });
                // Admin bisa assign ke diri sendiri
                const adminOption = document.createElement('option');
                adminOption.value = currentUserId;
                adminOption.textContent = `${currentUsername} (Saya)`;
                assignUserIdSelect.prepend(adminOption);
                // assignUserIdSelect.value = currentUserId; // Tidak default ke admin sendiri agar pengguna admin selalu memilih
            } else {
                console.error('Failed to fetch users for select:', data.message);
            }
        } catch (error) {
            console.error('Error fetching users for select:', error);
        }
    }

    async function fetchUsers() {
        try {
            // --- Perubahan di sini: Panggil aksi baru 'read_with_debt_summary' ---
            const response = await fetch(`${API_BASE_URL}users.php?action=read_with_debt_summary`);
            const data = await response.json();
            if (data.success) {
                displayUsers(data.users);
            } else {
                console.error('Error fetching users:', data.message);
                showMessage(userFormMessage, 'Gagal mengambil data pengguna: ' + data.message, 'error');
            }
        } catch (error) {
            console.error('Error fetching users:', error);
            showMessage(userFormMessage, 'Terjadi kesalahan saat mengambil data pengguna.', 'error');
        }
    }

    function displayUsers(users) {
        userList.innerHTML = '';
        if (users.length === 0) {
            userList.innerHTML = '<p style="text-align: center; color: var(--secondary-color);">Belum ada pengguna lain tercatat.</p>';
            return;
        }

        users.forEach(user => {
            const listItem = document.createElement('li');
            listItem.setAttribute('data-id', user.id);
            const formattedDate = new Date(user.created_at).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
            const totalUnpaid = formatRupiah(user.total_unpaid_debt); // Ambil dan format total utang

            listItem.innerHTML = `
                <div class="user-info">
                    <strong>Username:</strong> ${user.username}<br>
                    <strong>Role:</strong> ${user.role}<br>
                    <strong>Terdaftar:</strong> ${formattedDate}<br>
                    <strong>Total Utang Belum Lunas:</strong> <span style="color: ${user.total_unpaid_debt > 0 ? 'var(--danger-dark)' : 'var(--success-dark)'}; font-weight: bold;">${totalUnpaid}</span>
                </div>
                <div class="user-actions">
                    <button class="btn danger-btn delete-user">Hapus</button>
                </div>
            `;

            const deleteUserButton = listItem.querySelector('.delete-user');
            if (deleteUserButton) {
                deleteUserButton.addEventListener('click', async () => {
                    const userIdToDelete = listItem.getAttribute('data-id');
                    if (confirm(`Yakin ingin menghapus pengguna '${user.username}'? Utang terkait juga akan terhapus!`)) {
                        try {
                            const response = await fetch(`${API_BASE_URL}users.php?action=delete`, {
                                method: 'DELETE',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ id: userIdToDelete })
                            });
                            const data = await response.json();
                            if (data.success) {
                                showMessage(userFormMessage, data.message, 'success');
                                fetchUsers(); // Muat ulang daftar pengguna
                                fetchUsersForSelect(); // Perbarui dropdown di form utang
                            } else {
                                showMessage(userFormMessage, data.message, 'error');
                            }
                        } catch (error) {
                            console.error('Error deleting user:', error);
                            showMessage(userFormMessage, 'Terjadi kesalahan saat menghapus pengguna.', 'error');
                        }
                    }
                });
            }
            userList.appendChild(listItem);
        });
    }

    if (showAddUserFormBtn) {
        showAddUserFormBtn.addEventListener('click', () => {
            addUserSection.style.display = addUserSection.style.display === 'block' ? 'none' : 'block';
            userFormMessage.textContent = ''; // Clear message
        });
    }

    if (userForm) {
        userForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const newUsername = newUsernameInput.value.trim();
            const newUserPassword = newUserPasswordInput.value;

            if (!newUsername || !newUserPassword) {
                showMessage(userFormMessage, 'Username dan password harus diisi.', 'error');
                return;
            }

            try {
                const response = await fetch(`${API_BASE_URL}users.php?action=create`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: newUsername, password: newUserPassword, role: 'user' }) // Default 'user'
                });
                const data = await response.json();

                if (data.success) {
                    showMessage(userFormMessage, data.message, 'success');
                    newUsernameInput.value = '';
                    newUserPasswordInput.value = '';
                    fetchUsers(); // Muat ulang daftar user
                    fetchUsersForSelect(); // Perbarui dropdown
                } else {
                    showMessage(userFormMessage, data.message, 'error');
                }
            } catch (error) {
                console.error('Error adding user:', error);
                showMessage(userFormMessage, 'Terjadi kesalahan saat menambahkan pengguna.', 'error');
            }
        });
    }

    // --- User-specific total debt ---
    async function fetchTotalUnpaidDebt() {
        try {
            const response = await fetch(`${API_BASE_URL}debts.php?action=total_debt`);
            const data = await response.json();
            if (data.success) {
                totalUnpaidAmountSpan.textContent = formatRupiah(data.total_unpaid_debt);
            } else {
                console.error('Error fetching total unpaid debt:', data.message);
                totalUnpaidAmountSpan.textContent = 'Error';
            }
        } catch (error) {
            console.error('Error fetching total unpaid debt:', error);
            totalUnpaidAmountSpan.textContent = 'Error';
        }
    }

    // --- Initialize (Run on page load) ---
    checkSession(); // Panggil ini untuk memeriksa sesi saat dashboard dimuat

    // Jika ini halaman login, pastikan tidak ada sesi aktif (opsional, untuk UX)
    if (window.location.pathname.includes('index.html')) {
        fetch(`${API_BASE_URL}auth.php?action=check_session`)
            .then(res => res.json())
            .then(data => {
                if (data.success && data.logged_in) {
                    // Jika sudah login, langsung arahkan ke dashboard
                    redirectTo('dashboard.html');
                }
            })
            .catch(err => console.error('Error checking session on login page:', err));
    }
});
