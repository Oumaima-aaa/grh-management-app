<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\Exceptions\HttpResponseException;

class LoginRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'email' => ['required', 'email', 'max:255'],
            'password' => ['required', 'string', 'min:8', 'max:128'],
        ];
    }

    public function messages(): array
    {
        return [
            'email.required' => 'L email est obligatoire.',
            'email.email' => 'Format d email invalide.',
            'password.required' => 'Le mot de passe est obligatoire.',
            'password.min' => 'Le mot de passe doit contenir au moins 8 caracteres.',
        ];
    }

    public function validationData(): array
    {
        $data = parent::validationData();
        if (!empty($data['email']) || !empty($data['password'])) {
            return $data;
        }

        $raw = $this->getContent();
        if ($raw) {
            $decoded = json_decode($raw, true);
            if (is_array($decoded)) {
                return $decoded;
            }
        }

        return $data;
    }

    protected function prepareForValidation(): void
    {
        $email = $this->input('email');
        $password = $this->input('password');

        $this->merge([
            'email' => is_string($email) ? trim(strtolower($email)) : $email,
            'password' => is_string($password) ? trim($password) : $password,
        ]);
    }

    protected function failedValidation(Validator $validator): void
    {
        throw new HttpResponseException(response()->json([
            'error' => $validator->errors()->first(),
            'errors' => $validator->errors(),
        ], 422));
    }
}
