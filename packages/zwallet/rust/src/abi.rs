//! The C ABI the JS worker talks to.
//!
//! JS allocates input buffers with [`zw_alloc`], calls [`zw_call`] with a method name, a JSON
//! argument object and an optional binary payload, then reads the JSON reply from
//! [`zw_result_ptr`] / the returned length. Replies are always `{"ok": <value>}` or
//! `{"error": "<message>"}`, so a failure never traps the module.

use std::cell::RefCell;

thread_local! {
    static RESULT: RefCell<Vec<u8>> = const { RefCell::new(Vec::new()) };
}

/// Allocates `len` bytes inside the module for JS to fill.
#[unsafe(no_mangle)]
pub extern "C" fn zw_alloc(len: usize) -> *mut u8 {
    let mut buf = Vec::<u8>::with_capacity(len.max(1));
    let ptr = buf.as_mut_ptr();
    std::mem::forget(buf);
    ptr
}

/// Frees a buffer from [`zw_alloc`].
///
/// # Safety
/// `ptr` and `len` must come from one earlier [`zw_alloc`] call.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn zw_free(ptr: *mut u8, len: usize) {
    if !ptr.is_null() {
        // SAFETY: the caller passes back exactly what zw_alloc handed out.
        drop(unsafe { Vec::from_raw_parts(ptr, 0, len.max(1)) });
    }
}

/// Pointer to the last reply.
#[unsafe(no_mangle)]
pub extern "C" fn zw_result_ptr() -> *const u8 {
    RESULT.with(|r| r.borrow().as_ptr())
}

/// Runs one method and returns the reply length.
///
/// # Safety
/// Each (pointer, length) pair must describe readable memory inside this module.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn zw_call(
    method_ptr: *const u8,
    method_len: usize,
    args_ptr: *const u8,
    args_len: usize,
    bin_ptr: *const u8,
    bin_len: usize,
) -> usize {
    // SAFETY: the JS client writes these buffers through zw_alloc before calling.
    let method = unsafe { slice(method_ptr, method_len) };
    let args = unsafe { slice(args_ptr, args_len) };
    let bin = unsafe { slice(bin_ptr, bin_len) };
    let reply = match std::str::from_utf8(method) {
        Ok(name) => match serde_json::from_slice::<serde_json::Value>(if args.is_empty() { b"{}" } else { args }) {
            Ok(args) => match crate::dispatch(name, &args, bin) {
                Ok(value) => serde_json::json!({ "ok": value }),
                Err(e) => serde_json::json!({ "error": e.to_string() }),
            },
            Err(e) => serde_json::json!({ "error": format!("bad arguments: {e}") }),
        },
        Err(_) => serde_json::json!({ "error": "method name is not UTF-8" }),
    };
    let bytes = serde_json::to_vec(&reply).unwrap_or_else(|_| br#"{"error":"reply encoding"}"#.to_vec());
    let len = bytes.len();
    RESULT.with(|r| *r.borrow_mut() = bytes);
    len
}

unsafe fn slice<'a>(ptr: *const u8, len: usize) -> &'a [u8] {
    if ptr.is_null() || len == 0 {
        &[]
    } else {
        // SAFETY: guaranteed by the caller of zw_call.
        unsafe { std::slice::from_raw_parts(ptr, len) }
    }
}

/// Splits a payload of `[u32 little-endian length][message]...` frames.
pub fn frames(bin: &[u8]) -> Result<Vec<&[u8]>, crate::Error> {
    let mut out = vec![];
    let mut rest = bin;
    while !rest.is_empty() {
        let (head, tail) = rest.split_at_checked(4).ok_or_else(|| crate::Error::msg("truncated frame header"))?;
        let len = u32::from_le_bytes([head[0], head[1], head[2], head[3]]) as usize;
        let (msg, tail) = tail.split_at_checked(len).ok_or_else(|| crate::Error::msg("truncated frame"))?;
        out.push(msg);
        rest = tail;
    }
    Ok(out)
}
