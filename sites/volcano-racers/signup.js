// Sends the newsletter form to /api/subscribe without leaving the page.
// Without JavaScript the form still posts normally and lands on /thanks.
(function () {
  var form = document.querySelector('form[name="newsletter"]');
  if (!form) return;
  var status = document.getElementById('form-status');
  var button = form.querySelector('button[type="submit"]');
  var email = form.elements.email;
  var adult = form.elements.age_confirmed;
  var field = email.closest('.tn-field');
  var sending = false;

  function show(msg, kind) {
    status.textContent = msg;
    status.className = 'status' + (kind ? ' status--' + kind : '');
  }

  // Error coming back from a no-JS submit
  if (/[?&]signup=error/.test(location.search)) {
    show("That didn't go through. Please check your email and try again.", 'error');
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (sending) return; // block double submits

    var value = email.value.trim();
    email.value = value;
    if (!value || !email.checkValidity()) {
      show('Please enter a valid email address.', 'error');
      email.setAttribute('aria-invalid', 'true');
      if (field) field.classList.add('tn-field--error');
      email.focus();
      return;
    }
    email.removeAttribute('aria-invalid');
    if (field) field.classList.remove('tn-field--error');
    if (!adult.checked) {
      show('Please confirm you are 18 or older.', 'error');
      adult.focus();
      return;
    }

    sending = true;
    button.disabled = true;
    button.textContent = 'Sending…';
    show('');

    fetch('/api/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: new URLSearchParams(new FormData(form)).toString()
    })
      .then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (data) {
          if (!res.ok || !data.ok) throw new Error(data.error || 'HTTP ' + res.status);
        });
      })
      .then(function () {
        form.reset();
        show("You're signed up. We'll email you when Issue #1 is ready.", 'ok');
        button.textContent = 'Signed up';
      })
      .catch(function (err) {
        var msg = err && err.message && err.message.indexOf('HTTP') !== 0 && err.message !== 'Failed to fetch'
          ? err.message
          : "That didn't go through. Check your connection and try again.";
        show(msg, 'error');
        button.disabled = false;
        button.textContent = 'Sign me up';
        sending = false;
      });
  });
})();
