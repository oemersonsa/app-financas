"""Integração real com SQLite e Chromium. Requer Playwright Python e Chromium."""
import json
import os
from pathlib import Path
import tempfile
import subprocess
from urllib.request import urlopen
import unittest
from playwright.sync_api import sync_playwright, expect



class BrowserTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.playwright = sync_playwright().start()
        cls.browser = cls.playwright.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.playwright.stop()

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.process = subprocess.Popen(['node','server.js','--port','0','--data-dir',self.temp.name], cwd=Path(__file__).resolve().parents[1], stdout=subprocess.PIPE, text=True)
        info = json.loads(self.process.stdout.readline())
        self.url = f'http://127.0.0.1:{info["port"]}'
        class Store:
            def read(inner):
                with urlopen(self.url + '/api/state') as response:
                    return json.load(response)
        self.store = Store()
        self.context = self.browser.new_context(timezone_id='America/Sao_Paulo', viewport={'width':1440,'height':1000})
        self.page = self.context.new_page()
        self.errors = []
        self.page.on('pageerror', lambda error: self.errors.append(str(error)))
        self.page.goto(self.url)
        self.ready(self.page)

    def ready(self, page):
        expect(page.locator('#storageStatus')).to_contain_text('servidor · backup')

    def tearDown(self):
        self.assertEqual(self.errors, [])
        self.context.close()
        self.process.terminate()
        self.process.wait(timeout=10)
        self.process.stdout.close()
        self.temp.cleanup()

    def add(self, name, amount, schedule='once', kind='expense', date='2026-01-31', count=3, paid=False):
        self.page.locator('#addButton').click()
        self.page.locator(f'[data-type={kind}]').click()
        if kind == 'expense':
            self.page.locator('#schedule').select_option(schedule)
        if schedule == 'installments':
            self.page.locator('#installments').fill(str(count))
        self.page.locator('#description').fill(name)
        self.page.locator('#amount').fill(amount)
        self.page.locator('#date').fill(date)
        self.page.locator('#category').fill('Moradia' if schedule=='fixed' else 'Dívidas de cartão')
        if kind=='expense':
            self.page.locator('#paid').set_checked(paid)
        self.page.locator('button[type=submit]').click()
        expect(self.page.locator('#transactionDialog')).not_to_be_visible()
        self.ready(self.page)

    def test_installments_counts_amounts_and_month_end(self):
        self.add('Notebook', '100.00', schedule='installments', paid=True)
        expect(self.page.locator('#installmentsPage')).to_be_visible()
        expect(self.page.locator('#installmentsPaid')).to_contain_text('33,34')
        expect(self.page.locator('#installmentsRemaining')).to_contain_text('66,66')
        expect(self.page.locator('#installmentsPaidCount')).to_contain_text('1 parcela paga')
        rows=self.store.read()['data']['transactions']
        self.assertEqual([r['rawDate'] for r in rows],['2026-01-31','2026-02-28','2026-03-31'])
        self.assertEqual([r['amount'] for r in rows],[33.34,33.33,33.33])
        self.page.locator('.installment-plan summary').click()
        self.page.get_by_role('button',name='Marcar como paga: parcela 2 de Notebook',exact=True).click()
        expect(self.page.locator('#installmentsPaid')).to_contain_text('66,67')
        expect(self.page.locator('#installmentsRemaining')).to_contain_text('33,33')
        expect(self.page.locator('.installment-plan')).to_have_attribute('open','')
        self.page.reload()
        self.ready(self.page)
        expect(self.page.locator('#installmentsRemaining')).to_contain_text('33,33')
        self.page.locator('.installment-plan summary').click()
        self.page.get_by_role('button',name='Marcar como pendente: parcela 2 de Notebook',exact=True).click()
        expect(self.page.locator('#installmentsRemaining')).to_contain_text('66,66')
        self.page.locator('nav a[href="#overview"]:visible').click()
        expect(self.page.locator('#totalExpense')).to_contain_text('0,00') # recarregar abre mês atual
        self.assertEqual(len(self.store.read()['data']['transactions']),3)

    def test_fixed_repeats_without_duplicates_and_preserves_day(self):
        self.add('Aluguel', '900', schedule='fixed', paid=True)
        self.page.locator('#nextMonth').click()
        expect(self.page.locator('#totalExpense')).to_contain_text('900,00')
        rows=self.store.read()['data']['transactions']
        self.assertEqual(rows[1]['rawDate'],'2026-02-28')
        self.assertFalse(rows[1]['paid'])
        self.page.locator('#nextMonth').click()
        expect(self.page.locator('#monthLabel')).to_contain_text('março',ignore_case=True)
        self.page.locator('#previousMonth').click()
        expect(self.page.locator('.transaction-item')).to_have_count(1)
        self.assertEqual(len(self.store.read()['data']['transactions']),3)
        self.page.get_by_role('button',name='Excluir Aluguel').click()
        self.page.locator('#confirmDelete').click()
        expect(self.page.locator('.transaction-item')).to_have_count(0)
        self.page.locator('#previousMonth').click()
        self.page.get_by_role('button',name='Excluir Aluguel').click()
        self.page.locator('#confirmDelete').click()
        expect(self.page.locator('.transaction-item')).to_have_count(0)
        self.page.locator('#nextMonth').click()
        expect(self.page.locator('.transaction-item')).to_have_count(0)
        self.page.locator('#nextMonth').click()
        expect(self.page.locator('.transaction-item')).to_have_count(1)
        self.page.locator('#nextMonth').click()
        expect(self.page.locator('.transaction-item')).to_have_count(1)
        april=[r for r in self.store.read()['data']['transactions'] if r['rawDate']=='2026-04-30']
        self.assertEqual(len(april),1)

    def test_database_survives_new_browser_and_cleared_storage(self):
        self.add('Salário', '1000', kind='income')
        self.add('Mercado', '250', paid=True)
        expect(self.page.locator('#balanceDisplay')).to_contain_text('750,00')
        self.page.evaluate('localStorage.clear()')
        self.page.reload()
        self.ready(self.page)
        fresh=self.browser.new_context()
        try:
            page=fresh.new_page()
            page.goto(self.url)
            self.ready(page)
            self.assertEqual(page.evaluate("async () => (await (await fetch('/api/state')).json()).data.transactions.length"),2)
            self.assertEqual(page.evaluate('localStorage.getItem("finances_transactions_v3")'),None)
        finally:
            fresh.close()

    def test_edit_one_installment_backup_and_delete_series(self):
        self.add('Compra', '120', schedule='installments')
        self.page.locator('.installment-plan summary').click()
        self.page.get_by_role('button',name='Editar parcela 2 de Compra',exact=True).click()
        expect(self.page.locator('#schedule')).to_be_disabled()
        self.page.locator('#amount').fill('45')
        self.page.locator('button[type=submit]').click()
        expect(self.page.locator('#installmentsTotal')).to_contain_text('125,00')
        self.page.locator('#backupButton').click()
        with self.page.expect_download() as info:
            self.page.locator('#exportButton').click()
        backup=Path(info.value.path()).read_bytes()
        self.assertEqual(len(json.loads(backup)['transactions']),3)
        self.page.locator('#importFile').set_input_files({'name':'backup.json','mimeType':'application/json','buffer':backup})
        expect(self.page.locator('#backupDialog')).not_to_be_visible()
        self.assertEqual(len(self.store.read()['data']['transactions']),3)
        self.page.get_by_role('button',name='Excluir parcelamento',exact=True).click()
        expect(self.page.locator('#deleteHint')).to_contain_text('Todas as parcelas')
        self.page.get_by_role('button',name='Cancelar',exact=True).click()
        self.assertEqual(len(self.store.read()['data']['transactions']),3)
        self.page.get_by_role('button',name='Excluir parcelamento',exact=True).click()
        self.page.locator('#confirmDelete').click()
        expect(self.page.locator('#installmentsEmpty')).to_be_visible()
        self.assertEqual(self.store.read()['data']['transactions'],[])

    def test_failed_network_does_not_confirm_save(self):
        self.page.route('**/api/state',lambda route: route.abort() if route.request.method=='PUT' else route.continue_())
        self.page.locator('#addButton').click()
        self.page.locator('#description').fill('Não salva')
        self.page.locator('#amount').fill('50')
        self.page.locator('button[type=submit]').click()
        expect(self.page.locator('#formError')).to_contain_text('não foi salvo')
        expect(self.page.locator('#transactionDialog')).to_be_visible()
        self.assertEqual(self.store.read()['data']['transactions'],[])

    def test_legacy_migration_and_installment_compatibility(self):
        legacy=[{'id':1,'description':'Compra antiga','amount':20,'type':'expense','category':'Lazer','rawDate':'2026-01-31','totalInstallments':2,'installmentNumber':1,'parentId':None}, {'id':2,'description':'Compra antiga','amount':20,'type':'expense','category':'Lazer','rawDate':'2027-02-28','totalInstallments':2,'installmentNumber':2,'parentId':1}]
        self.page.evaluate('(rows)=>localStorage.setItem("finances_transactions_v3",JSON.stringify(rows))',legacy)
        self.page.reload()
        self.ready(self.page)
        self.page.locator('a[href="#parcelas"]:visible').click()
        expect(self.page.locator('.installment-plan')).to_have_count(1)
        expect(self.page.locator('#installmentsPaid')).to_contain_text('20,00')
        expect(self.page.locator('#installmentsRemaining')).to_contain_text('20,00')
        self.assertEqual(len(self.store.read()['data']['transactions']),2)
        self.page.reload()
        self.ready(self.page)
        self.assertEqual(len(self.store.read()['data']['transactions']),2)

    def test_stale_browser_cannot_overwrite_another_device(self):
        fresh=self.browser.new_context()
        try:
            other=fresh.new_page()
            other.goto(self.url)
            self.ready(other)
            self.add('Primeiro dispositivo','10')
            other.locator('#addButton').click()
            other.locator('#description').fill('Registro concorrente')
            other.locator('#amount').fill('20')
            other.locator('button[type=submit]').click()
            expect(other.locator('#formError')).to_contain_text('não foi salvo')
            self.assertEqual(len(self.store.read()['data']['transactions']),1)
            other.locator('button[type=submit]').click()
            expect(other.locator('#transactionDialog')).not_to_be_visible()
            self.assertEqual(len(self.store.read()['data']['transactions']),2)
        finally:
            fresh.close()

    def test_categories_mobile_layout_and_escaping(self):
        expect(self.page.locator('.sidebar')).to_have_css('position', 'fixed')
        options=self.page.locator('#categoryOptions option').evaluate_all('(els)=>els.map(el=>el.value)')
        for name in ['Moradia','Alimentação','Assinaturas','Lazer','Pensão','Dívidas de cartão','Empréstimos']:
            self.assertIn(name,options)
        self.add('<img src=x onerror="window.injected=true">','80',schedule='installments')
        self.assertFalse(self.page.evaluate('!!window.injected'))
        expect(self.page.locator('#installmentPlans img')).to_have_count(0)
        for width in [320,390,768,1440]:
            self.page.set_viewport_size({'width':width,'height':900})
            self.assertTrue(self.page.evaluate('document.documentElement.scrollWidth <= innerWidth'),width)
            self.page.locator('nav a[href="#overview"]:visible').click()
            self.assertTrue(self.page.evaluate('document.documentElement.scrollWidth <= innerWidth'),width)
            self.page.locator('a[href="#parcelas"]:visible').click()

    def test_vue_charts_filters_and_backup_merge(self):
        self.add('Salário', '6500', kind='income', date='2026-10-01')
        self.add('Aluguel', '1500', schedule='fixed', date='2026-10-05', paid=True)
        self.add('Internet', '120', date='2026-10-15')
        expect(self.page.locator('.donut')).to_contain_text('1.620,00')
        self.page.locator('.chart-data summary').click()
        october = self.page.locator('.chart-data tbody tr').nth(9)
        expect(october).to_contain_text('6.500,00')
        expect(october).to_contain_text('1.620,00')
        self.page.locator('.upcoming-title').click()
        expect(self.page.locator('#description')).to_have_value('Internet')
        self.page.get_by_role('button', name='Fechar formulário').click()
        self.page.locator('.upcoming-panel').get_by_role('button', name='Ver todos').click()
        expect(self.page.locator('.transaction-item:visible')).to_have_count(1)
        expect(self.page.locator('.transaction-item:visible')).to_contain_text('Internet')
        self.page.locator('#backupButton').click()
        rows = self.store.read()['data']['transactions']
        changed = dict(rows[0], amount=1)
        added = dict(rows[1], id='import-unique', description='Backup adicional', amount=10, recurring=False)
        backup = json.dumps({'transactions':[changed,added,added]}).encode()
        self.page.locator('#importFile').set_input_files({'name':'backup.json','mimeType':'application/json','buffer':backup})
        expect(self.page.locator('#backupDialog')).not_to_be_visible()
        current = self.store.read()['data']['transactions']
        self.assertEqual(len(current),4)
        self.assertEqual(current[0]['amount'],6500)
        self.page.locator('nav a[href="#overview"]:visible').click()
        expect(self.page.locator('#totalExpense')).to_contain_text('1.630,00')

    def register_user(self, page, username, name='Conta teste'):
        page.goto(self.url + '/login.html')
        page.get_by_role('button',name='Criar conta',exact=True).click()
        page.locator('#name').fill(name)
        page.locator('#username').fill(username)
        page.locator('#password').fill('test-password-123')
        page.locator('#confirmPassword').fill('test-password-123')
        page.locator('.login-submit').click()
        self.ready(page)

    def test_registration_login_isolation_and_no_legacy_import(self):
        self.add('Registro do proprietário', '99', date='2026-10-14')
        original=self.store.read()['data']['transactions']
        self.page.evaluate('(rows)=>localStorage.setItem("finances_transactions_v3",JSON.stringify(rows))',original)
        self.register_user(self.page,'alice','Alice')
        expect(self.page.locator('.account-name')).to_have_text('Alice')
        self.assertEqual(self.page.evaluate('async()=> (await (await fetch("/api/state")).json()).data.transactions'),[])
        self.add('Registro da Alice','12',date='2026-10-14')
        self.assertEqual(self.store.read()['data']['transactions'][0]['description'],'Registro do proprietário')
        fresh=self.browser.new_context()
        try:
            other=fresh.new_page()
            self.register_user(other,'bob','Bob')
            self.assertEqual(other.evaluate('async()=> (await (await fetch("/api/state")).json()).data.transactions'),[])
        finally:fresh.close()
        self.page.locator('#logoutButton').click()
        expect(self.page.locator('#loginForm')).to_be_visible()
        self.page.locator('#username').fill('alice')
        self.page.locator('#password').fill('test-password-123')
        self.page.locator('.login-submit').click()
        self.ready(self.page)
        self.assertEqual(self.page.evaluate('async()=> (await (await fetch("/api/state")).json()).data.transactions[0].description'),'Registro da Alice')

    def test_account_switch_blocks_stale_form_and_ios_fields_use_16px(self):
        self.register_user(self.page,'alice','Alice')
        self.page.locator('#addButton').click()
        self.page.locator('#description').fill('Não gravar na conta da Bob')
        self.page.locator('#amount').fill('45')
        other=self.context.new_page()
        try:
            # Registration changes the shared session cookie while Alice has an open form.
            other.goto(self.url + '/login.html')
            other.evaluate('async()=>fetch("/api/logout",{method:"POST"})')
            self.register_user(other,'bob','Bob')
            self.page.locator('button[type=submit]').click()
            self.ready(self.page)
            expect(self.page.locator('.account-name')).to_have_text('Bob')
            self.assertEqual(self.page.evaluate('async()=> (await (await fetch("/api/state")).json()).data.transactions'),[])
        finally:other.close()
        self.page.set_viewport_size({'width':390,'height':844})
        self.page.get_by_role('button',name='Novo lançamento',exact=True).click()
        for selector in ['#description','#amount','#date','#category','#schedule']:
            expect(self.page.locator(selector)).to_have_css('font-size','16px')
        viewport=self.page.locator('meta[name="viewport"]').get_attribute('content')
        self.assertNotIn('user-scalable=no',viewport)
        self.assertNotIn('maximum-scale',viewport)
        self.page.get_by_role('button',name='Fechar formulário').click()
        self.page.locator('#logoutButton').click()
        self.page.get_by_role('button',name='Criar conta',exact=True).click()
        for selector in ['#name','#username','#password','#confirmPassword','#loginTheme']:
            expect(self.page.locator(selector)).to_have_css('font-size','16px')
        icon=self.page.locator('link[rel="apple-touch-icon"]')
        expect(icon).to_have_attribute('sizes','180x180')
        self.assertIn('v2',icon.get_attribute('href'))
        self.assertTrue(self.page.evaluate('document.documentElement.scrollWidth<=innerWidth'))

    def wait_for_worker(self, page):
        page.evaluate("""async () => {
            await navigator.serviceWorker.ready;
            if (!navigator.serviceWorker.controller) {
                await new Promise(resolve => navigator.serviceWorker.addEventListener('controllerchange', resolve, {once:true}));
            }
        }""")

    def test_pwa_offline_fallback_public_cache_and_reconnect(self):
        self.wait_for_worker(self.page)
        self.add('Registro online', '50', date='2026-10-14')
        paths = self.page.evaluate("""async () => {
            const result=[];
            for (const name of await caches.keys()) {
                for (const request of await (await caches.open(name)).keys()) result.push(new URL(request.url).pathname);
            }
            return result;
        }""")
        self.assertIn('/offline.html',paths)
        for private in ['/', '/index.html', '/login.html', '/api/state', '/api/session', '/build/app.js']:
            self.assertNotIn(private, paths)
        self.context.set_offline(True)
        self.page.reload()
        expect(self.page.get_by_role('heading',name='Vamos reconectar?')).to_be_visible()
        expect(self.page.locator('html')).to_have_attribute('data-theme','light')
        self.assertEqual(self.store.read()['data']['transactions'][0]['description'],'Registro online')
        self.context.set_offline(False)
        self.page.get_by_role('link',name='Tentar novamente').click()
        self.ready(self.page)
        self.assertEqual(len(self.store.read()['data']['transactions']),1)

    def test_pwa_api_is_not_available_from_cache_while_offline(self):
        self.wait_for_worker(self.page)
        self.context.set_offline(True)
        result = self.page.evaluate("async () => { try { return (await fetch('/api/state')).status; } catch { return 0; } }")
        self.assertEqual(result,0)
        self.context.set_offline(False)
        self.assertEqual(self.page.evaluate("async () => (await fetch('/api/state')).status"),200)
        paths = self.page.evaluate("""async () => {
            const result=[];
            for (const name of await caches.keys()) {
                for (const request of await (await caches.open(name)).keys()) result.push(new URL(request.url).pathname);
            }
            return result;
        }""")
        self.assertNotIn('/api/state',paths)

    def test_theme_system_persistence_and_other_tabs(self):
        self.page.emulate_media(color_scheme='dark')
        expect(self.page.locator('html')).to_have_attribute('data-theme','dark')
        self.page.get_by_role('combobox',name='Tema',exact=True).select_option('light')
        expect(self.page.locator('html')).to_have_attribute('data-theme','light')
        self.page.emulate_media(color_scheme='dark')
        expect(self.page.locator('html')).to_have_attribute('data-theme','light')
        self.page.get_by_role('combobox',name='Tema',exact=True).select_option('dark')
        self.page.reload()
        self.ready(self.page)
        expect(self.page.locator('html')).to_have_attribute('data-theme','dark')
        expect(self.page.get_by_role('combobox',name='Tema',exact=True)).to_have_value('dark')
        other=self.context.new_page()
        try:
            other.goto(self.url)
            self.ready(other)
            other.get_by_role('combobox',name='Tema',exact=True).select_option('light')
            expect(self.page.locator('html')).to_have_attribute('data-theme','light')
            expect(self.page.get_by_role('combobox',name='Tema',exact=True)).to_have_value('light')
            self.page.get_by_role('combobox',name='Tema',exact=True).select_option('system')
            expect(self.page.locator('html')).to_have_attribute('data-theme','dark')
            self.page.emulate_media(color_scheme='light')
            expect(self.page.locator('html')).to_have_attribute('data-theme','light')
        finally: other.close()
        for width in [320,390,768,1440]:
            self.page.set_viewport_size({'width':width,'height':900})
            self.page.get_by_role('combobox',name='Tema',exact=True).select_option('dark')
            self.assertTrue(self.page.evaluate('document.documentElement.scrollWidth <= innerWidth'),width)
        self.page.get_by_role('button',name='Novo lançamento',exact=True).click()
        expect(self.page.locator('#transactionDialog')).to_be_visible()
        expect(self.page.locator('#transactionDialog')).to_have_css('background-color','rgb(25, 41, 54)')

    def test_mobile_add_edit_and_pending_filter(self):
        self.page.set_viewport_size({'width':390,'height':844})
        self.page.get_by_role('button',name='Novo lançamento',exact=True).click()
        self.page.locator('#description').fill('Compra pelo celular')
        self.page.locator('#amount').fill('75')
        self.page.locator('#date').fill('2026-10-13')
        self.page.locator('#category').fill('Categoria nova')
        self.page.locator('#paid').uncheck()
        self.page.locator('button[type=submit]').click()
        expect(self.page.locator('#transactionDialog')).not_to_be_visible()
        expect(self.page.locator('#balanceDisplay')).to_contain_text('-R$')
        self.page.locator('.mobile-nav a[href="#transactions"]').click()
        self.page.get_by_role('button',name='Editar Compra pelo celular',exact=True).click()
        self.page.locator('#amount').fill('80')
        self.page.locator('button[type=submit]').click()
        expect(self.page.locator('#transactionDialog')).not_to_be_visible()
        self.page.get_by_role('button',name='Marcar como paga: Compra pelo celular',exact=True).click()
        expect(self.page.locator('.transaction-item:visible .badge')).to_have_text('Pago')
        self.assertEqual(self.store.read()['data']['transactions'][0]['amount'],80)
        self.page.get_by_role('button',name='Pendentes',exact=True).click()
        expect(self.page.locator('.transaction-item:visible')).to_have_count(0)
        self.assertTrue(self.page.evaluate('document.documentElement.scrollWidth <= innerWidth'))
        self.page.locator('.mobile-nav').get_by_role('button',name='Backup',exact=True).click()
        expect(self.page.locator('#backupDialog')).to_be_visible()

    def test_login_remember_restart_and_logout(self):
        env = os.environ.copy()
        env.update(FINANCAS_USER='emerson', FINANCAS_PASSWORD='test-browser-password', NODE_ENV='development', HOST='127.0.0.1')
        env.pop('TURSO_DATABASE_URL', None)
        env.pop('TURSO_AUTH_TOKEN', None)
        args = ['node','server.js','--port','0','--data-dir',str(Path(self.temp.name)/'login')]
        def start():
            process = subprocess.Popen(args, cwd=Path(__file__).resolve().parents[1], env=env, stdout=subprocess.PIPE, text=True)
            info = json.loads(process.stdout.readline())
            return process, f'http://127.0.0.1:{info["port"]}'
        process, url = start()
        context = self.browser.new_context(viewport={'width':390,'height':844})
        restored = None
        try:
            page = context.new_page()
            page.goto(url)
            expect(page).to_have_url(url + '/login.html')
            expect(page.locator('.login-card')).to_have_css('border-radius','26px')
            self.assertTrue(page.evaluate('document.documentElement.scrollWidth <= innerWidth'))
            self.wait_for_worker(page)
            page.locator('#loginTheme').select_option('dark')
            expect(page.locator('html')).to_have_attribute('data-theme','dark')
            page.locator('#username').fill('emerson')
            page.locator('#password').fill('wrong')
            page.locator('.login-submit').click()
            expect(page.locator('#loginError')).to_contain_text('incorretos')
            page.locator('#password').fill('test-browser-password')
            page.locator('#showPassword').click()
            expect(page.locator('#password')).to_have_attribute('type','text')
            page.locator('.login-submit').click()
            self.ready(page)
            expect(page.locator('#logoutButton')).to_be_visible()
            expect(page.locator('html')).to_have_attribute('data-theme','dark')
            page.set_viewport_size({'width':320,'height':844})
            self.assertTrue(page.evaluate('document.documentElement.scrollWidth <= innerWidth'))
            state = context.storage_state()
            self.assertEqual(state['origins'][0]['localStorage'], [{'name':'meu-bolso-theme','value':'dark'}])
            self.assertTrue(state['cookies'][0]['httpOnly'])
            process.terminate(); process.wait(timeout=10); process.stdout.close()
            process, url = start()
            restored = self.browser.new_context(storage_state=state)
            page = restored.new_page()
            page.goto(url)
            self.ready(page)
            page.locator('#logoutButton').click()
            expect(page).to_have_url(url + '/login.html')
            page.goto(url)
            expect(page).to_have_url(url + '/login.html')
            self.assertEqual(restored.cookies(), [])
        finally:
            if restored: restored.close()
            context.close()
            process.terminate(); process.wait(timeout=10); process.stdout.close()


if __name__ == '__main__':
    unittest.main()
